#!/bin/sh
set -e

echo "Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
until npx prisma migrate deploy 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Database migration failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Database not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES), retrying in 2s..."
  sleep 2
done

echo "Database migrations applied successfully"

echo "Starting API server..."
exec node apps/api/dist/index.js
