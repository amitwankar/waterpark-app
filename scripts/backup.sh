#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/aquaworld/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

cd /opt/aquaworld

docker compose exec -T db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${OUTPUT_FILE}"

ls -1t "${BACKUP_DIR}"/db_*.sql.gz | tail -n +31 | xargs -r rm -f

echo "Backup created: ${OUTPUT_FILE}"
