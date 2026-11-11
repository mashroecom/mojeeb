#!/bin/sh
# Bring the database schema up to date. Safe to run on every container start.
#
#   * new database      -> applies all migrations (creates the pgvector extension too)
#   * migrated database -> applies pending migrations only (no-op when up to date)
#   * legacy database that was created with `prisma db push` (no migration history)
#                       -> syncs it one last time, records the baseline migration as
#                          applied, and from then on it is a normal migrated database
set -e

BASELINE_MIGRATION="20260311000000_baseline"
SCHEMA="prisma/schema.prisma"
MAX_RETRIES="${DB_MAX_RETRIES:-30}"

run_sql() {
  printf '%s\n' "$1" | npx prisma db execute --stdin --schema "$SCHEMA"
}

echo "Waiting for database to be ready..."
RETRY_COUNT=0
# Also guarantees pgvector exists before anything touches the `vector` column type
until run_sql 'CREATE EXTENSION IF NOT EXISTS vector;' >/dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: could not reach the database (or create the pgvector extension) after $MAX_RETRIES attempts"
    run_sql 'CREATE EXTENSION IF NOT EXISTS vector;' || true
    exit 1
  fi
  echo "Database not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES), retrying in 2s..."
  sleep 2
done

echo "Applying database migrations..."
set +e
OUTPUT=$(npx prisma migrate deploy --schema "$SCHEMA" 2>&1)
STATUS=$?
set -e
echo "$OUTPUT"

if [ "$STATUS" -ne 0 ]; then
  # P3005: the database has tables but no migration history -> created by `db push`
  if echo "$OUTPUT" | grep -q "P3005"; then
    echo "Database has no migration history (created with 'prisma db push'). Baselining..."
    npx prisma db push --schema "$SCHEMA" --skip-generate --accept-data-loss
    npx prisma migrate resolve --schema "$SCHEMA" --applied "$BASELINE_MIGRATION"
    # `db push` cannot manage this index (and drops it), so (re)create it once here
    run_sql 'CREATE INDEX IF NOT EXISTS "kb_chunks_embedding_idx" ON "kb_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);'
    npx prisma migrate deploy --schema "$SCHEMA"
  else
    echo "ERROR: database migration failed"
    exit "$STATUS"
  fi
fi

echo "Database schema is up to date"
