# Mojeeb (مجيب)

AI-powered customer support platform. Businesses connect their channels (WhatsApp,
Messenger, Instagram, website chat widget), create AI agents backed by their own
knowledge base, and handle conversations, leads and analytics from one dashboard.
Arabic-first (RTL) with full English support.

## Repository layout

| Path                    | What it is                                                         |
| ----------------------- | ------------------------------------------------------------------ |
| `apps/api`              | REST + WebSocket API — Express, Prisma, BullMQ workers (port 4000) |
| `apps/web`              | Web app — Next.js 15, next-intl, React Query, Tailwind (port 3000) |
| `packages/shared-types` | Types and plan limits shared by API and web                        |
| `packages/shared-utils` | Zod validation schemas, formatters, constants                      |
| `packages/widget`       | Embeddable website chat widget (served by the API at `/widget.js`) |
| `prisma`                | Database schema and migrations (PostgreSQL + pgvector)             |
| `docker`, `nginx`       | Local infrastructure compose file and reverse-proxy config         |
| `helm`, `k8s`           | Kubernetes deployment manifests                                    |
| `scripts`               | Ops scripts (migrations, backups, load tests, i18n check)          |

The web app has four areas: the marketing site, the customer dashboard, the
super-admin panel (`/admin`) and a mobile inbox (`/mobile`).

## Requirements

- Node.js 20+ and pnpm 10 (`corepack enable`)
- PostgreSQL 16 with the [pgvector](https://github.com/pgvector/pgvector) extension
- Redis 7

`docker/docker-compose.yml` starts Postgres (with pgvector) and Redis with the
credentials used in `.env.example`.

## Quick start

```bash
# 1. Infrastructure
docker compose -f docker/docker-compose.yml up -d

# 2. Environment — then set JWT_SECRET and ENCRYPTION_KEY (commands are in the file)
cp .env.example .env

# 3. Dependencies and shared packages
pnpm install
pnpm --filter @mojeeb/shared-types build
pnpm --filter @mojeeb/shared-utils build
pnpm --filter @mojeeb/widget build

# 4. Database: schema, then plans + a super-admin account
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed

# 5. Run API and web together
pnpm dev
```

Open http://localhost:3000. `pnpm db:seed` prints the super-admin credentials the first
time it runs; sign in with them and open `/admin`.

AI replies and knowledge-base embeddings need `OPENAI_API_KEY` (and/or
`ANTHROPIC_API_KEY`). Without a key everything else works, but agents cannot answer and
uploaded documents stay un-embedded. Channel, payment and email integrations are
likewise optional and are configured through the variables in `.env.example` or in
Admin → Config.

## Database

Migrations are the source of truth for the schema.

| Command                  | Use                                                        |
| ------------------------ | ---------------------------------------------------------- |
| `pnpm db:migrate:deploy` | Apply pending migrations (CI, production, fresh checkouts) |
| `pnpm db:migrate`        | Create a new migration while developing a schema change    |
| `pnpm db:seed`           | Idempotent seed: plan configs and the super-admin account  |
| `pnpm db:generate`       | Regenerate the Prisma client                               |

Things to know:

- **Avoid `prisma db push` on shared databases.** The knowledge-base vector index
  (`kb_chunks_embedding_idx`, HNSW) cannot be expressed in `schema.prisma`, so `db push`
  silently drops it. For the same reason, when `prisma migrate dev` generates a
  migration containing `DROP INDEX "kb_chunks_embedding_idx"`, delete that line before
  committing.
- **Databases created earlier with `db push`** have no migration history. Mark the
  baseline as applied once: `pnpm exec prisma migrate resolve --applied 20260311000000_baseline`.
  The container entrypoint (`scripts/migrate-deploy.sh`) detects this case and does it
  automatically.
- `prisma/schema.prisma` and `apps/api/prisma/schema.prisma` must stay identical.

### Seeding the super admin

| Variable              | Default                                  |
| --------------------- | ---------------------------------------- |
| `SEED_ADMIN_EMAIL`    | `admin@mojeeb.local` (development only)  |
| `SEED_ADMIN_PASSWORD` | generated and printed once (development) |
| `SEED_ADMIN_ORG`      | `Mojeeb`                                 |

In production both the email and the password must be provided, otherwise the step is
skipped. If the user already exists it is promoted to super admin and its password is
left unchanged.

## Development

```bash
pnpm dev                                   # API + web (turbo)
pnpm --filter @mojeeb/api dev              # API only
pnpm --filter @mojeeb/web dev              # web only

pnpm --filter @mojeeb/api test             # unit tests (vitest)
pnpm --filter @mojeeb/api exec tsc --noEmit
pnpm --filter @mojeeb/web exec tsc --noEmit
pnpm exec eslint apps/api/src packages/shared-utils/src packages/shared-types/src
pnpm format:check
node scripts/check-i18n.js                 # en.json / ar.json must have the same keys
```

In development the API process also runs the queue workers. In production they run as
a separate process (`apps/api/src/worker.ts`, `apps/api/Dockerfile.worker`); set
`ENABLE_WORKERS=true` to run them inside the API instead.

Every user-facing string lives in `apps/web/src/messages/en.json` and `ar.json`; add
new keys to both.

## Production

`docker-compose.prod.yml` runs nginx, the API, the worker, the web app, Postgres (with
an optional read replica) and Redis. Required configuration:

- `POSTGRES_PASSWORD`, `REDIS_PASSWORD`
- `JWT_SECRET` (32+ random characters) and `ENCRYPTION_KEY` (64 hex characters) — the
  API refuses to start in production with missing or placeholder values
- `FRONTEND_URL`, and `NEXT_PUBLIC_API_URL` at web **build** time

On start the API container runs `scripts/migrate-deploy.sh`, which waits for the
database, ensures the pgvector extension exists and applies pending migrations. Run
`pnpm db:seed` once with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` set to create the
first super admin.

Health endpoints: `GET /health` (liveness), `GET /ready` and `GET /api/v1/health/ready`
(database, Redis and queue connectivity).
