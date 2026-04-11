#!/bin/bash
BACKUP_FILE=$1
gunzip -c $BACKUP_FILE | docker compose -f /opt/waterpark-app/docker-compose.yml \
  exec -T postgres psql -U waterpark_user -d waterpark_db
