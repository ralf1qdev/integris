# Deployment

Integris runs as three processes — **web**, **bot**, **worker** — plus PostgreSQL 16 and Redis 7.

## Requirements

* **One bot process** per application (no sharding is configured; discord.js recommends sharding above ~2,500 guilds).
* Any number of **web** instances behind a load balancer (sessions live in PostgreSQL, rate limits in Redis).
* One or more **worker** instances. Per-guild Redis locks keep concurrent workers consistent.
* **Redis** with `maxmemory-policy noeviction` (BullMQ requirement) and persistence enabled.
* **HTTPS** for the dashboard. When `APP_URL` starts with `https://`, cookies use the `__Host-` prefix and `Secure`, and HSTS is sent.

## Environment

All variables are documented in [`.env.example`](../.env.example). In production:

* Generate `SESSION_SECRET` and `ENCRYPTION_KEY` with `openssl rand -base64 32` and store them in your platform's secret manager.
* `APP_URL` must be the public origin; it is used for CSRF origin checks, OAuth redirects and links in alerts.
* `DISCORD_REDIRECT_URI` must match the portal exactly.
* Rotating `ENCRYPTION_KEY` invalidates stored OAuth tokens; users simply sign in again.

## Docker (single host)

```bash
cp .env.example .env   # fill in production values
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm bot node dist/register.js   # once
```

The `migrate` service applies Prisma migrations before web, bot and worker start. Put a TLS-terminating reverse proxy (Caddy, nginx, a cloud load balancer) in front of port 3000 and forward `X-Forwarded-For`.

## Platform deployments

Build each target from the root `Dockerfile` (`--target web|bot|worker|migrate`) or run the apps directly:

```bash
pnpm install --frozen-lockfile
pnpm db:deploy                            # prisma migrate deploy
pnpm build
node apps/worker/dist/index.js
node apps/bot/dist/index.js
pnpm --filter @integris/web start
```

Use managed PostgreSQL and Redis where possible. Run `migrate` as a release step before rolling out new web/bot/worker versions.

## Operations

* `GET /api/health` reports database and Redis reachability (503 when degraded).
* All services log structured JSON to stdout. Tokens, webhook URLs and authorization headers are redacted by the logger.
* Scheduled jobs (created by the worker on start): reconciliation scans every `SCAN_INTERVAL_MINUTES`, retention daily at 03:17 UTC.
* Failed jobs are kept for 7 days in BullMQ for inspection.
* Backups: PostgreSQL holds all durable state; Redis holds only queues, locks, rate-limit counters and a 60-second guild cache.
