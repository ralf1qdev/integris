# Security model

## Risk engine

All findings come from pure functions in `packages/security`, unit-tested in `packages/security/test`.

### Effective permissions

`computeBasePermissions` ORs `@everyone` with every role the bot holds; Administrator (or ownership) expands to all permissions. `computeChannelPermissions` applies overwrites in Discord's documented order — `@everyone` overwrite, then the union of role overwrites (deny, then allow), then the member overwrite — and treats a channel without View Channel as granting nothing.

### Bot rules

| Rule | Severity | Condition |
|------|----------|-----------|
| `bot.administrator` | High (Critical if Discord reports the bot unverified) | Administrator at server level |
| `bot.permission.ManageGuild` | Medium | Manage Server |
| `bot.permission.ManageRoles` | Medium | Manage Roles |
| `bot.permission.ManageWebhooks` | Medium | Manage Webhooks |
| `bot.permission.ManageChannels` | Medium | Manage Channels |
| `bot.permission.BanMembers` | Medium | Ban Members |
| `bot.permission.KickMembers` | Low | Kick Members |
| `bot.permission.MentionEveryone` | Low | Mention @everyone |
| `bot.permission.ModerateMembers` | Low | Timeout Members |
| `bot.role-hierarchy` | High / Medium | Manage Roles and positioned above non-managed roles carrying permissions the bot lacks (High if any has Administrator) |
| `bot.channel-overwrite` | Medium / Low | Overwrites grant sensitive permissions beyond the server-wide set |
| `bot.unverified-privileged` | Medium | Known-unverified bot with a Medium+ finding |

A bot's **risk classification** is the highest severity among its findings (`NONE` when there are none). Integris' own bot is listed but not scored.

### Webhook rules

| Rule | Severity | Condition |
|------|----------|-----------|
| `webhook.restricted-channel` | High | Unapproved webhook in a restricted channel |
| `webhook.created-by-bot` | Low | Unapproved incoming webhook created by a bot account |
| `webhook.unreviewed` | Info | Not yet approved |

### Event alerts

| Event | Severity |
|-------|----------|
| New bot joined | max(Medium, bot risk) |
| Bot gained Administrator | Critical (High if trusted) |
| Bot gained another sensitive permission | High (Medium if trusted) |
| Unapproved webhook created | Medium (High in a restricted channel) |
| Protected webhook modified | High |
| Webhook deleted | Low; Medium if approved; High if protected |

Trusted bots do not alert when their permissions return to (or stay within) the set approved at trust time.

### Security score

```
score = max(0, round(100 − Σ weight(severity) × factor(status)))
weight: CRITICAL 25 · HIGH 10 · MEDIUM 4 · LOW 1 · INFO 0
factor: OPEN 1 · ACKNOWLEDGED 0.5 · RESOLVED 0
AT_RISK if any open CRITICAL or score < 50; NEEDS_ATTENTION if any open HIGH or score < 80; else HEALTHY.
```

## Alert lifecycle and deduplication

* Findings are keyed by `(guild, rule, resource)`. Scans create, update, auto-resolve or reopen them.
* An alert is raised only when a finding is **created** or **reopened after auto-resolution** — never for an unchanged finding. Event alerts carry deterministic dedup keys (for example `webhook-created:<id>`).
* While an alert with the same key is open or acknowledged, repeats increment `occurrences` instead of notifying again. After resolution, repeats within the guild's cooldown (default 60 min) are also suppressed.
* The first scan after install is a baseline: no "created" events, and only High/Critical findings alert.
* Alerts linked to a finding auto-resolve when the finding clears.

## Application security controls

| Control | Implementation |
|---------|----------------|
| OAuth2 | Authorization-code flow; random `state` in an HTTP-only cookie compared in constant time; scopes `identify guilds` only; post-login redirect restricted to same-site paths |
| Sessions | 256-bit random token in an HTTP-only, `SameSite=Lax`, `__Host-`/`Secure` cookie (HTTPS); only its SHA-256 hash is stored; 7-day expiry; logout deletes the server record and revokes the Discord token on last session |
| Token storage | OAuth tokens encrypted with AES-256-GCM; associated data binds each ciphertext to its user and token type |
| Authorization | `authorizeGuildAccess`: membership and permissions from Discord's `/users/@me/guilds`, fetched server-side and cached ≤ 2 minutes; requires owner, Administrator or Manage Server; requires Integris installed. Nothing from the browser is trusted |
| Guild isolation | Every repository query includes `guildId`; updates use `updateMany({ where: { id, guildId } })`; trust/notes/settings verify referenced objects belong to the guild; webhook delete re-verifies ownership with Discord. Covered by integration tests |
| CSRF | Mutations require a matching `Origin` and an `X-Integris-CSRF` header equal to HMAC(session); plus SameSite cookies |
| Rate limiting | Redis fixed windows per user and route class; fails closed for mutations; manual scans also limited per guild in the database |
| Validation | Zod schemas with `.strict()`, body size limit, snowflake validation |
| Webhook secrets | Tokens/URLs dropped in `toSafeWebhook` immediately after the REST call; never stored, logged, returned or embedded; logger and embeds run `redactSecrets` |
| Destructive actions | Webhook delete requires retyping the name, an explicit dialog and records an audit event with the administrator; data deletion requires owner/Administrator and the server name; nothing destructive happens automatically |
| Discord commands | Default member permission Manage Server, re-checked at runtime; guild-only; ephemeral replies; buttons act only on alerts of the guild they were clicked in |
| Headers | CSP, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS in production, `no-store` on API and dashboard |
| Least privilege | Five bot permissions, no Administrator, no message-content or presence intents |
| Retention | Per-guild retention for history; abandoned guilds erased after 30 days; one-step full deletion with an audit record |
