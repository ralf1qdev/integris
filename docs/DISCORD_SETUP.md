# Discord Developer Portal setup

1. Go to https://discord.com/developers/applications → **New Application** → name it *Integris* (or your own name).
2. **General Information**: copy the **Application ID** → `DISCORD_CLIENT_ID`.
3. **OAuth2**
   * **Client Secret** → *Reset Secret* → `DISCORD_CLIENT_SECRET`.
   * **Redirects** → add exactly `DISCORD_REDIRECT_URI`, e.g. `http://localhost:3000/api/auth/callback` for development and `https://your-domain/api/auth/callback` in production.
   * The dashboard requests only the `identify` and `guilds` scopes.
4. **Bot**
   * **Reset Token** → `DISCORD_BOT_TOKEN`. Treat it like a password; it is only ever read by the bot, worker and web server processes.
   * **Public Bot**: on if anyone should be able to add Integris, off for a private deployment.
   * **Privileged Gateway Intents**: enable **Server Members Intent** (required to detect bot joins, departures and role changes, and to list bot accounts). Leave *Presence* and *Message Content* **off** — Integris does not use them.
5. **Installation** (optional): Integris builds its own invite link at `/invite` with these permissions (`536890496`):

   | Permission      | Why |
   |-----------------|-----|
   | View Audit Log  | attribute changes to an actor where Discord records one |
   | View Channels   | read channel names and permission overwrites |
   | Send Messages   | deliver alerts |
   | Embed Links     | render alert embeds |
   | Manage Webhooks | Discord only lists webhooks to members with this permission; also used by the confirmed emergency delete |

   Integris never requests Administrator.
6. Register slash commands: `pnpm commands:register`. With `DISCORD_DEV_GUILD_ID` set they appear in that server immediately; otherwise they are registered globally and can take up to an hour to propagate.

### Verifying the setup

* `/security` in your server should answer privately.
* The dashboard's overview should show "Last successful sync" within a minute of adding the bot.
* If the Bots page says *bot inventory unavailable*, the Server Members Intent is off.
* If the Webhooks page says *webhook inventory unavailable*, the Integris role lacks Manage Webhooks.
