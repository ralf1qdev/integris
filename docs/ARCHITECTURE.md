# Architecture details

## Data flow for a change

1. A moderator gives the *Helpers* role Administrator.
2. The bot receives `GUILD_ROLE_UPDATE` with the cached previous permissions and enqueues a `role.updated` signal (job id = role + new bitfield, so redelivery is idempotent).
3. The worker takes the guild lock, records `ROLE_PERMISSIONS_CHANGED`, refreshes the role/channel snapshot over REST, and re-evaluates every bot holding the role.
4. For each bot whose effective permissions changed it records `BOT_PERMISSIONS_CHANGED`; if dangerous permissions were gained it records `PERMISSION_ESCALATION`, updates findings and raises a deduplicated alert.
5. If an alert channel is configured and the severity meets the threshold, an `integris-alerts` job posts an embed with Acknowledge / Resolve buttons.
6. When the corresponding audit-log entry arrives, the worker attaches the actor to the events that still say *Unknown*.

## Queues

| Queue | Producer | Purpose |
|-------|----------|---------|
| `integris-scan` | web, bot, worker | Full reconciliation scans (`ScanJob` rows track status) |
| `integris-events` | bot | Normalised Gateway signals |
| `integris-alerts` | worker, web | Deliver alerts; edit delivered messages after status changes |
| `integris-maintenance` | worker scheduler, web | Scheduled scans, retention, guild data deletion |

Every payload is validated with the Zod schema in `packages/shared/src/queue.ts` on consumption. Jobs retry five times with exponential backoff from 5 s. Discord permission errors that retries cannot fix are marked unrecoverable and surfaced to the user (e.g. "Integris lacks Send Messages in the alert channel").

## Consistency

* Scans and event processing for the same guild are serialised by `withGuildLock` (Redis `SET NX PX` + compare-and-delete). A job that cannot take the lock is re-delayed, not blocked.
* Inventory transitions (joined, left, permissions changed, webhook created/updated/deleted) are computed by diffing against stored state inside the lock, so a scan and a Gateway event cannot both report the same change.
* Audit events use per-guild dedup keys where an upstream identity exists.

## Database

See `packages/database/prisma/schema.prisma`. Highlights:

* Snowflakes are strings. Every guild-scoped table has `guildId` with `onDelete: Cascade`, so deleting a `Guild` removes all of its data.
* Unique constraints: `(guildId, botUserId)`, `(guildId, webhookId)`, `(guildId, kind, targetId)` for trust, `(guildId, fingerprint)` for findings, `(guildId, dedupKey)` for events.
* `GuildAccess` caches the Discord-verified authorization decision with `checkedAt`.
* `DataDeletionLog` intentionally has no foreign key so deletions remain auditable.
