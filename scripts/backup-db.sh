#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/waterpark-db"
COMPOSE_DIR="/opt/waterpark-app"
mkdir -p $BACKUP_DIR
docker compose -f $COMPOSE_DIR/docker-compose.yml exec -T postgres \
  pg_dump -U waterpark_user waterpark_db | gzip > $BACKUP_DIR/waterpark_$DATE.sql.gz
echo "$(date): Backup completed" >> $BACKUP_DIR/backup.log
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
