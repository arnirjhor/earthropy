# Operations Guide

Day-to-day reference for self-hosters running Earthropy in production.

See also: [`docs/self-host.md`](self-host.md), [`docs/configuration.md`](configuration.md).

---

## Getting started

### Prerequisites

- Docker 24+ and Docker Compose v2 (`docker compose`, not `docker-compose`)
- A domain name with an A/AAAA record pointing to your server's public IP
- Ports 80 and 443 open on the host firewall

Earthropy is licensed under **AGPLv3**. If you run a public instance and modify the source, you must make those modifications available to your users. The platform exposes an "About this instance" page for this purpose.

### First-time setup

```bash
# 1. Clone the repository
git clone https://github.com/<org>/earthropy
cd earthropy

# 2. Create your environment file
cp .env.production.example .env.production

# 3. Fill in required values — at minimum:
#    DOMAIN, DATABASE_URL, POSTGRES_PASSWORD, REDIS_URL, AUTH_SECRET
#    See docs/configuration.md for the full reference.
$EDITOR .env.production

# 4. Build images and start the stack
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 5. Run database migrations
docker compose -f docker-compose.prod.yml exec app pnpm db:migrate

# 6. Seed the 17 SDGs
docker compose -f docker-compose.prod.yml exec app pnpm db:seed
```

Caddy will automatically obtain a TLS certificate from Let's Encrypt for the domain set in `DOMAIN`. The first request may be slow while the cert is issued.

---

## Backup and restore

### Postgres backup

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U earthropy earthropy > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Postgres restore

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U earthropy earthropy < backup.sql
```

### Volume backup

Docker named volumes are stored under `/var/lib/docker/volumes/` on Linux. The relevant volumes are:

| Volume | Contents |
|---|---|
| `earthropy_postgres-data` | All Postgres data |
| `earthropy_redis-data` | BullMQ job queues (transient — loss is non-critical) |
| `earthropy_caddy-data` | TLS certificates (Caddy regenerates if lost) |
| `earthropy_caddy-config` | Caddy config cache |

To back up Postgres data at the volume level (stop the container first to ensure consistency):

```bash
docker compose -f docker-compose.prod.yml stop postgres
tar czf postgres-data-$(date +%Y%m%d).tar.gz \
  -C /var/lib/docker/volumes/earthropy_postgres-data _data
docker compose -f docker-compose.prod.yml start postgres
```

**Recommendation:** schedule `pg_dump` via cron and ship the SQL file to S3-compatible storage (MinIO, Backblaze, etc.).

---

## Upgrading

```bash
# 1. Pull latest source
git pull origin main

# 2. Rebuild images and restart containers with zero-downtime rolling restart
docker compose -f docker-compose.prod.yml --env-file .env.production build

# 3. Bring containers up (Compose replaces only changed services)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 4. Run any new migrations
docker compose -f docker-compose.prod.yml exec app pnpm db:migrate
```

### Rollback strategy

Before upgrading, tag the current images:

```bash
docker tag earthropy-prod-app:latest earthropy-prod-app:previous
docker tag earthropy-prod-api:latest earthropy-prod-api:previous
```

To roll back:

```bash
# Restore previous images
docker tag earthropy-prod-app:previous earthropy-prod-app:latest
docker tag earthropy-prod-api:previous earthropy-prod-api:latest

# Restart with the old images (no --build)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Revert the last migration if necessary (check Drizzle docs for down migrations)
```

---

## Monitoring

### Check service health

```bash
docker compose -f docker-compose.prod.yml ps
```

All five services (`postgres`, `redis`, `app`, `api`, `caddy`) should show `healthy`. `app` and `api` have a 60 s start period before their health checks begin.

### View logs

```bash
# Stream all logs
docker compose -f docker-compose.prod.yml logs -f

# Stream logs for a specific service
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f caddy
```

Caddy access logs are written to stdout in JSON format (configured in `deploy/Caddyfile`). Pipe to `jq` for readability:

```bash
docker compose -f docker-compose.prod.yml logs caddy | jq .
```

---

## Troubleshooting

### Port conflicts

If ports 80 or 443 are already in use, `caddy` will fail to start.

```bash
# Find what is using port 80
lsof -i :80
```

Stop the conflicting service or configure it to use different ports. Caddy's port bindings are set in `docker-compose.prod.yml` under the `caddy` service.

### TLS certificate not issuing

- Verify the `DOMAIN` value in `.env.production` matches your DNS record exactly (no trailing dot, no `https://` prefix).
- Check that port 80 is reachable from the internet — ACME HTTP-01 challenge requires it.
- Inspect Caddy logs: `docker compose -f docker-compose.prod.yml logs caddy`.
- If testing locally with `DOMAIN=localhost`, Caddy uses a self-signed certificate — your browser will show a warning.

### Database connection failures

- Confirm `DATABASE_URL` uses the service name `postgres` (not `localhost`) as the host when running inside Docker.
- Ensure `POSTGRES_PASSWORD` in `DATABASE_URL` matches `POSTGRES_PASSWORD` in `.env.production`.
- Check the Postgres service is healthy: `docker compose -f docker-compose.prod.yml ps postgres`.
- View Postgres logs: `docker compose -f docker-compose.prod.yml logs postgres`.

### Redis connection failures

- Confirm `REDIS_URL` uses `redis` (not `localhost`) as the host.
- Check the Redis service is healthy: `docker compose -f docker-compose.prod.yml ps redis`.
- View Redis logs: `docker compose -f docker-compose.prod.yml logs redis`.

### Reset to a clean state

```bash
# Stop all containers and remove volumes (DESTROYS ALL DATA)
docker compose -f docker-compose.prod.yml down -v

# Rebuild and start fresh
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml exec app pnpm db:migrate
docker compose -f docker-compose.prod.yml exec app pnpm db:seed
```

> **Warning:** `-v` removes named volumes including all Postgres data. Only use this on a non-production instance or if you have a backup to restore from.
