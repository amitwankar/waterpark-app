# Waterpark & Amusement Park Management Software

## Stack
- Next.js 14 (App Router) + TypeScript
- PostgreSQL 16 (via Prisma ORM)
- Redis 7 (sessions + cache)
- Docker Compose
- Nginx + Let's Encrypt SSL

## Quick Start (Development)
1. cp .env.example .env  (fill in values)
2. docker compose up -d postgres redis
3. cd app && npm install
4. npx prisma migrate dev
5. npx prisma db seed
6. npm run dev

## Production
See docs/deployment-ubuntu24-arm64.md
