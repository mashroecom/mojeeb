#!/bin/sh
set -e

sh scripts/migrate-deploy.sh

echo "Starting API server..."
exec node apps/api/dist/index.js
