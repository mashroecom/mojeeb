#!/bin/bash
# ===========================================
# Mojeeb Database Backup Script
# Usage: ./scripts/backup-db.sh
# Cron:  0 2 * * * /path/to/mojeeb/scripts/backup-db.sh
# ===========================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/mojeeb_${TIMESTAMP}.sql.gz"

# Load env vars if .env exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi

# Extract DB connection from DATABASE_URL or use defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mojeeb}"
DB_USER="${DB_USER:-mojeeb}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting database backup..."

# If running in Docker, use docker exec
if [ "${USE_DOCKER:-false}" = "true" ]; then
  CONTAINER="${POSTGRES_CONTAINER:-mojeeb-postgres-1}"
  docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
else
  # Direct pg_dump
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
fi

# Verify backup
BACKUP_SIZE=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}" 2>/dev/null || echo "0")
if [ "${BACKUP_SIZE}" -lt 100 ]; then
  echo "[$(date)] ERROR: Backup file is too small (${BACKUP_SIZE} bytes). Backup may have failed."
  exit 1
fi

echo "[$(date)] Backup created: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Cleanup old backups
if [ "${RETENTION_DAYS}" -gt 0 ]; then
  DELETED=$(find "${BACKUP_DIR}" -name "mojeeb_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
  if [ "${DELETED}" -gt 0 ]; then
    echo "[$(date)] Cleaned up ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
  fi
fi

echo "[$(date)] Backup complete."
