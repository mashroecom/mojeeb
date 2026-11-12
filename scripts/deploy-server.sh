#!/usr/bin/env bash
# One-command deployment of Mojeeb on a fresh Ubuntu server, on one (sub)domain.
#
#   curl -fsSL https://raw.githubusercontent.com/mashroecom/mojeeb/<branch>/scripts/deploy-server.sh \
#     | sudo bash -s -- app.example.com [admin@example.com]
#
# Before running it, point the domain's DNS A record at this server's IP address.
#
# What it does (safe to run again; later runs update the code and keep data and secrets):
#   1. installs Docker and git if missing, and adds swap on small machines
#   2. clones or updates the code in /opt/mojeeb
#   3. writes /opt/mojeeb/deploy/.env with freshly generated secrets (first run only)
#   4. builds and starts web, api, worker, PostgreSQL, Redis and Caddy (automatic HTTPS)
#   5. creates the super-admin account (first run only) and prints its login
#
# Optional environment variables:
#   MOJEEB_BRANCH       git branch to deploy (default below)
#   ANTHROPIC_API_KEY   Claude API key; if unset and a terminal is attached, you are asked for it
set -euo pipefail

DOMAIN="${1:-}"
ADMIN_EMAIL="${2:-}"
BRANCH="${MOJEEB_BRANCH:-claude/sweet-hypatia-x47z3i}"
REPO="https://github.com/mashroecom/mojeeb.git"
DIR=/opt/mojeeb

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root (sudo)"
[ -n "$DOMAIN" ] || die "usage: deploy-server.sh <domain> [admin-email]"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "'$DOMAIN' is not a domain name"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@$DOMAIN}"

# --- 1. ports, packages, swap ------------------------------------------------
# Ports 80/443 free: Caddy serves the site with automatic HTTPS.
# nginx already on them (other sites on this server): keep nginx, add one site for
# this domain and get its certificate with certbot. Anything else: stop.
port_owner() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'users:(("[^"]*' | cut -d'"' -f2 | head -1 || true; }
MODE=caddy
for port in 80 443; do
  owner=$(port_owner "$port")
  case "$owner" in
    "") ;;
    nginx) MODE=nginx ;;
    docker-proxy)
      docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^mojeeb-caddy-' \
        || die "port $port is used by another Docker container. Free it, or put nginx in front of both sites." ;;
    *) die "port $port is used by '$owner'. Only free ports or nginx are supported." ;;
  esac
done
say "Web server mode: $MODE"

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "docker compose plugin is missing"
command -v git >/dev/null 2>&1 || { apt-get update -y && apt-get install -y git; }

mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
swap_mb=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$mem_mb" -lt 6000 ] && [ "$swap_mb" -lt 2000 ] && [ ! -f /swapfile ]; then
  say "Adding 4 GB swap (the web build needs more memory than this server has)"
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

COMPOSE=(docker compose -f "$DIR/deploy/docker-compose.single.yml" --env-file "$DIR/deploy/.env")
if [ "$MODE" = caddy ]; then COMPOSE+=(--profile caddy); fi

# --- 2. code -----------------------------------------------------------------
if [ -d "$DIR/.git" ]; then
  say "Updating code ($BRANCH)"
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" checkout -B "$BRANCH" FETCH_HEAD
else
  say "Downloading code ($BRANCH)"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
fi

# --- 3. configuration ----------------------------------------------------------
ENV_FILE="$DIR/deploy/.env"
hex() { openssl rand -hex "$1"; }
FIRST_RUN=0
if [ ! -f "$ENV_FILE" ]; then
  FIRST_RUN=1
  say "Generating secrets in $ENV_FILE"
  ADMIN_PASSWORD="Mj-$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 14)#7a"
  umask 077
  cat > "$ENV_FILE" <<EOF
DOMAIN=$DOMAIN
NODE_ENV=production
FRONTEND_URL=https://$DOMAIN
API_URL=https://$DOMAIN
POSTGRES_PASSWORD=$(hex 24)
REDIS_PASSWORD=$(hex 24)
JWT_SECRET=$(hex 48)
ENCRYPTION_KEY=$(hex 32)
SEED_ADMIN_EMAIL=$ADMIN_EMAIL
SEED_ADMIN_PASSWORD=$ADMIN_PASSWORD
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
EMAIL_FROM=Mojeeb <noreply@$DOMAIN>
EOF
  umask 022
else
  sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN|; s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|; s|^API_URL=.*|API_URL=https://$DOMAIN|" "$ENV_FILE"
fi

# Claude key: from the environment, or asked for without echoing it
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|" "$ENV_FILE"
elif grep -q '^ANTHROPIC_API_KEY=$' "$ENV_FILE" && [ -r /dev/tty ]; then
  printf '\nClaude API key (sk-ant-...). Press Enter to skip and add it later in Admin > Config: ' > /dev/tty
  read -rs key < /dev/tty || key=""
  echo > /dev/tty
  [ -n "$key" ] && sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$key|" "$ENV_FILE"
fi

server_ip=$(curl -fsS4 https://api.ipify.org 2>/dev/null || true)
dns_ip=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}' || true)
if [ -n "$server_ip" ] && [ "$dns_ip" != "$server_ip" ]; then
  echo "WARNING: $DOMAIN resolves to '${dns_ip:-nothing}', this server is $server_ip."
  echo "         HTTPS will start working once the DNS A record points here."
fi

# --- 4. build and start ----------------------------------------------------------
say "Building and starting (the first build takes 10-20 minutes)"
"${COMPOSE[@]}" up -d --build --remove-orphans

if [ "$MODE" = nginx ]; then
  say "Adding an nginx site for $DOMAIN (other sites are not touched)"
  site="/etc/nginx/sites-available/mojeeb-$DOMAIN"
  if [ ! -f "$site" ]; then
    sed "s/__DOMAIN__/$DOMAIN/g" "$DIR/deploy/nginx-site.conf.template" > "$site"
  fi
  ln -sf "$site" "/etc/nginx/sites-enabled/mojeeb-$DOMAIN"
  if ! nginx -t; then
    rm -f "/etc/nginx/sites-enabled/mojeeb-$DOMAIN"
    die "nginx rejected the new site, so it was disabled again. File: $site"
  fi
  systemctl reload nginx
  command -v certbot >/dev/null 2>&1 || { apt-get update -y && apt-get install -y certbot python3-certbot-nginx; }
  if ! grep -q 'listen 443' "$site"; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
      --register-unsafely-without-email --redirect \
      || echo "WARNING: no HTTPS certificate yet (DNS not pointing here?). Later run: certbot --nginx -d $DOMAIN"
  fi
fi

say "Waiting for the API"
for i in $(seq 1 90); do
  if "${COMPOSE[@]}" exec -T api wget -qO- http://localhost:4000/health >/dev/null 2>&1; then break; fi
  [ "$i" -eq 90 ] && { "${COMPOSE[@]}" logs --tail 80 api; die "API did not become healthy"; }
  sleep 5
done

# --- 5. plans and admin account ----------------------------------------------------
say "Seeding plans and the admin account"
"${COMPOSE[@]}" exec -T api node apps/api/dist/scripts/seed.js

say "Done: https://$DOMAIN"
if [ "$FIRST_RUN" -eq 1 ]; then
  echo "Admin login:  https://$DOMAIN/login"
  echo "  email:      $ADMIN_EMAIL"
  echo "  password:   $ADMIN_PASSWORD"
  echo "Change this password after the first sign-in. It is also stored in $ENV_FILE."
else
  echo "Admin login is unchanged (see SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in $ENV_FILE)."
fi
