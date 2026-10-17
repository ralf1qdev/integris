# Integris

**Security for everything connected to your Discord.**

Integris is a Discord security platform focused on third-party integrations: it inventories every bot and webhook in a server, evaluates bot permissions with a deterministic risk engine, detects supported configuration changes, and raises deduplicated alerts in a web dashboard and a Discord channel.

It is deliberately *not* a moderation bot. It never bans or removes bots automatically, never claims to inspect a bot's code or behaviour, and never claims to see ordinary webhook traffic. See [Limitations](#limitations).

## Architecture

```
            ┌──────────────── Discord ────────────────┐
            │  Gateway events   REST API   OAuth2     │
            └────┬───────────────▲───────────▲────────┘
                 │ events        │ REST      │ authorization code
         ┌───────▼──────┐  ┌─────┴──────┐ ┌──┴────────────────────┐
         │  apps/bot    │  │ apps/worker│ │ apps/web (Next.js)    │
         │  discord.js  │  │  BullMQ    │ │ dashboard + API       │
         │  commands,   │  │  scans,    │ │ sessions, CSRF,       │
         │  buttons     │  │  diffing,  │ │ Discord-verified      │
         │              │  │  alerts    │ │ guild authorization   │
         └──┬────────┬──┘  └──▲─────┬───┘ └──┬─────────────┬──────┘
            │ signals│        │     │        │ scan jobs   │
            │        └─► Redis (BullMQ queues, locks, rate limits) ◄┘
            │                       │                      │
            └──────────────► PostgreSQL (Prisma) ◄─────────┘
```

* **Bot** listens to the Gateway and forwards small, normalised signals (bot joined, role permissions changed, "webhooks changed in channel X", audit-log entry…). It also serves slash commands and alert buttons straight from the database.
* **Worker** does the heavy lifting: REST lookups, reconciliation scans, webhook/bot diffing, rule evaluation, alert creation and Discord delivery. All work for one guild is serialised by a Redis lock so state transitions are consistent. Jobs retry with exponential backoff; `@discordjs/rest` handles rate-limit buckets.
* **Web** is the dashboard and authenticated API. Every guild-scoped request passes `guildRoute` → session → CSRF → rate limit → Discord-verified authorization.
* **Shared packages** keep the contracts single-sourced: `@integris/shared` (types, Zod schemas, queue contracts, redaction, embeds), `@integris/security` (permission maths and rules — pure, deterministic, unit-tested) and `@integris/database` (Prisma schema and guild-scoped repositories used by all three apps).

The website and the bot read and write the same rows: acknowledging an alert with a Discord button shows up in the dashboard, and resolving it in the dashboard edits the Discord message.

## Repository layout

```
apps/
  web/                  Next.js 15 App Router, Tailwind v4, shadcn-style UI, Recharts
    app/(marketing)/    /, /features, /pricing, /docs
    app/login/          sign-in
    app/dashboard/      server picker and /dashboard/[guildId]/{bots,webhooks,activity,alerts,settings}
    app/api/auth/       OAuth2 login, callback, logout
    app/api/guilds/     guild-scoped API (scan, settings, alerts, findings, trust, notes, webhook delete, data deletion)
    lib/                session, auth gate, Discord OAuth, rate limiting, queues
    test/               API authorization & isolation tests
  bot/                  discord.js client, Gateway handlers, slash commands, alert buttons
  worker/               BullMQ processors: scan, events, alerts, maintenance
  community/            separate bot for the official community server: welcome, suggestions, tickets, /post
packages/
  shared/               enums, Zod schemas, queue contracts, redaction, Discord embeds
  security/             permission engine, bot/webhook rules, escalation, security score
  database/             Prisma schema + migrations, encryption, repositories, integration tests
docs/                   architecture, Discord setup, deployment, security model
docker-compose.yml      PostgreSQL + Redis for local development
docker-compose.prod.yml full stack
Dockerfile              web / bot / worker / migrate targets
```

## Local development

Requirements: Node 22, pnpm 10, Docker (or local PostgreSQL 16 and Redis 7).

```bash
pnpm install
docker compose up -d                 # postgres + redis (also creates integris_test)
cp .env.example .env                 # then fill it in — see docs/DISCORD_SETUP.md
openssl rand -base64 32              # use for SESSION_SECRET
openssl rand -base64 32              # use for ENCRYPTION_KEY
pnpm db:migrate                      # apply migrations
pnpm commands:register               # register slash commands (instant with DISCORD_DEV_GUILD_ID)
pnpm dev                             # web on :3000, bot and worker with hot reload
```

Then open http://localhost:3000, sign in, pick a server and add Integris. The initial scan runs automatically.

### Tests

```bash
pnpm test             # everything (unit + integration, run serially)
pnpm test:unit        # security rules, redaction, embeds — no services needed
pnpm typecheck
```

Integration tests (`packages/database`, `apps/worker`, `apps/web`) need `DATABASE_URL_TEST` pointing at a **disposable** database; every test truncates all tables. They cover Discord-verified authorization, cross-guild isolation for every mutating route, CSRF, webhook-delete confirmation, alert deduplication and cooldowns, finding lifecycles, retention and the full bot/webhook monitoring pipeline.

## Documentation

* [Discord Developer Portal setup](docs/DISCORD_SETUP.md)
* [Deployment](docs/DEPLOYMENT.md)
* [Security model, rules and score](docs/SECURITY_MODEL.md)
* [Architecture details](docs/ARCHITECTURE.md)
* [Community server bot](docs/COMMUNITY_SERVER.md)

## Limitations

* Integris evaluates what a bot is **permitted** to do. It cannot inspect a bot's source, credentials, hosting or behaviour.
* Discord does not expose ordinary webhook requests to integrations, so Integris cannot see who posts through a webhook, count messages or measure sending rates. Enforcing posting limits would need a separate managed relay where Integris owns the inbound endpoint; that relay is **not implemented** in this release.
* Bot inventory requires the privileged **Server Members** intent. Without it, scans complete for webhooks and report that bot inventory is unavailable instead of guessing.
* Actors are shown only when Discord records them in the audit log; otherwise the UI says *Unknown*.
* Changes made while the bot is offline are picked up by the next reconciliation scan (on reconnect for stale guilds, and every `SCAN_INTERVAL_MINUTES`).
* Member listing is paginated over REST; very large servers (hundreds of thousands of members) make scans slower.
* Payments are not implemented; the pricing page describes the free beta.
