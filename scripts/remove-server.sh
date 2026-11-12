#!/usr/bin/env bash
# Removes a Mojeeb installation made by deploy-server.sh, and nothing else.
#
#   curl -fsSL https://raw.githubusercontent.com/mashroecom/mojeeb/<branch>/scripts/remove-server.sh \
#     | sudo bash -s -- mojeeb.example.com
#
# Deletes: the Mojeeb containers, their images and volumes (its database and uploads),
# /opt/mojeeb, and the nginx site and certificate created for that domain.
# Keeps: Docker itself, nginx and every other site, the swap file.
set -euo pipefail

DOMAIN="${1:-}"
DIR=/opt/mojeeb
say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)"; exit 1; }
[ -n "$DOMAIN" ] || { echo "usage: remove-server.sh <domain>"; exit 1; }

if [ -f "$DIR/deploy/docker-compose.single.yml" ]; then
  say "Stopping and removing the Mojeeb containers, images and data"
  docker compose -f "$DIR/deploy/docker-compose.single.yml" --env-file "$DIR/deploy/.env" \
    --profile caddy down --volumes --rmi local --remove-orphans || true
else
  echo "No Mojeeb installation in $DIR"
fi

# Containers left from an interrupted first run
ids=$(docker ps -aq --filter "label=com.docker.compose.project=mojeeb" 2>/dev/null || true)
[ -n "$ids" ] && docker rm -f $ids >/dev/null
vols=$(docker volume ls -q --filter "label=com.docker.compose.project=mojeeb" 2>/dev/null || true)
[ -n "$vols" ] && docker volume rm $vols >/dev/null
docker builder prune -f >/dev/null 2>&1 || true

site="mojeeb-$DOMAIN"
if [ -e "/etc/nginx/sites-available/$site" ] || [ -e "/etc/nginx/sites-enabled/$site" ]; then
  say "Removing the nginx site for $DOMAIN"
  rm -f "/etc/nginx/sites-enabled/$site" "/etc/nginx/sites-available/$site"
  nginx -t && systemctl reload nginx
fi
if command -v certbot >/dev/null 2>&1 && certbot certificates 2>/dev/null | grep -q "Certificate Name: $DOMAIN$"; then
  say "Removing the certificate for $DOMAIN"
  certbot delete --cert-name "$DOMAIN" --non-interactive
fi

rm -rf "$DIR"
say "Mojeeb removed from this server"
