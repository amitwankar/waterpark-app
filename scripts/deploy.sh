#!/bin/bash
set -e
cd /opt/waterpark-app
echo "Pulling latest code..."
git pull origin main
echo "Building app..."
docker compose build app --no-cache
echo "Running DB migrations..."
docker compose run --rm app npx prisma migrate deploy
echo "Restarting app..."
docker compose up -d app
docker image prune -f
echo "Done: $(date)"
docker compose ps
