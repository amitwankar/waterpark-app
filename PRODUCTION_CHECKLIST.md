# Production Deployment Checklist

## Infrastructure & Access
- [ ] OCI Ubuntu 24.04.4 ARM64 instance created with static public IP
- [ ] DNS A record points to production domain
- [ ] SSH key-only access enabled; password login disabled
- [ ] UFW enabled with only 22, 80, 443 open
- [ ] fail2ban installed and active

## TLS & Reverse Proxy
- [ ] Let's Encrypt certificates issued for production domain
- [ ] SSL cert auto-renew tested (`certbot renew --dry-run`)
- [ ] Nginx TLS restricted to TLSv1.2 and TLSv1.3
- [ ] HSTS enabled (`max-age=31536000; includeSubDomains`)
- [ ] Security headers active (X-Frame-Options, X-Content-Type-Options)

## Secrets & Environment
- [ ] `.env` created from `.env.example` with production values
- [ ] `ENCRYPTION_KEY` is exactly 32 chars
- [ ] Strong `POSTGRES_PASSWORD` and `REDIS_PASSWORD` set
- [ ] Better Auth secret generated with secure random source
- [ ] No test keys present in production `.env`

## Data Layer
- [ ] PostgreSQL container healthy and not exposed to internet
- [ ] Redis container healthy and not exposed to internet
- [ ] Redis auth enabled and maxmemory policy applied
- [ ] Prisma migrations applied (`prisma migrate deploy`)
- [ ] Seed executed safely (`npx prisma db seed`)

## Payments & Messaging
- [ ] Razorpay production keys configured (not test keys)
- [ ] Razorpay webhook URL registered with HTTPS endpoint
- [ ] Razorpay webhook secret configured and verified
- [ ] MSG91 sender ID approved and active
- [ ] SMTP production credentials configured and tested

## App Validation
- [ ] All Docker healthchecks passing (`docker compose ps`)
- [ ] `/api/health` returns HTTP 200 in production
- [ ] Booking creation flow tested end-to-end
- [ ] Payment verify flow tested end-to-end (gateway + manual UPI)
- [ ] Admin UPI queue and verification flow tested

## Backups, CI/CD & Operations
- [ ] Backup cron installed: `0 2 * * * /opt/aquaworld/scripts/backup.sh`
- [ ] Backup restore drill tested using `scripts/restore.sh`
- [ ] GitHub Actions secrets configured (SERVER_HOST, SERVER_USER, SERVER_SSH_KEY, ENV_FILE, GHCR_TOKEN)
- [ ] CI test job passes (migrate + type-check + lint + build)
- [ ] Deployment job completes and image prune runs successfully
