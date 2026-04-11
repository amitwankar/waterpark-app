#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: ./restore.sh path/to/backup.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

cd /opt/aquaworld

gunzip -c "${BACKUP_FILE}" | docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

echo "Restore completed from: ${BACKUP_FILE}"
