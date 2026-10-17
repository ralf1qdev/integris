# Community server bot

`apps/community` runs the official Integris Discord server. It is a **separate Discord application** from the Integris product bot, so the product bot keeps its five least-privilege permissions and never receives message events.

## Features

| Channel | Behaviour |
|---------|-----------|
| `#welcome` | Greets each new member and gives them the **Member** role. During a join burst (more than 8 joins in 30 s) roles are still given but greetings pause. |
| `#rules`, `#about-integris`, `#faq`, `#welcome` | `/post` publishes the copy in `src/content.ts`. Running it again edits the existing post instead of duplicating it. |
| `#help` | `/post content:Support` posts a panel with ticket buttons. Each ticket is a **private thread** visible only to the opener and staff (members with Manage Threads). Security reports ping the Integris Team instead of Support. One open ticket per member; closing locks and archives the thread and logs a summary in `#mod-log`. |
| `#suggestions` | Every new message gets 👍 / 👎 and a discussion thread. The bot never reads message content. |

Channel and role names are configured in `apps/community/src/config.ts`. Missing ones are logged at startup and the related feature is skipped.

## Setup

1. Create a second application in the Developer Portal (e.g. *Integris Community*). Under **Bot**, enable the **Server Members Intent**. Leave Message Content and Presence off.
2. Fill in `COMMUNITY_BOT_TOKEN`, `COMMUNITY_CLIENT_ID` and `COMMUNITY_GUILD_ID` (right-click the server → Copy Server ID with Developer Mode on).
3. `pnpm db:migrate`, then `pnpm community:register` — registers `/post` and prints the invite link with exactly these permissions: View Channels, Send Messages, Embed Links, Read Message History, Add Reactions, Manage Roles, Create Public/Private Threads, Send Messages in Threads, Manage Threads.
4. In **Server Settings → Roles**, drag the community bot's role **above Member** (it can only assign roles below its own).
5. Make sure **Support** and **Integris Team** have *Manage Threads*, so they can see every private ticket thread.
6. In `#help`, deny *Send Messages* and *Create Public Threads* for @everyone but keep *Send Messages in Threads* — members use the panel, and can still write inside their ticket.
7. To ping Support/Team when a ticket opens, either turn on "Allow anyone to @mention this role" for those roles or give the bot *Mention @everyone, @here and All Roles* (it only ever mentions the ticket's staff role).
8. Start it with `pnpm dev:community`, then run `/post` for each of: Start here, Server rules, About Integris, FAQ, Support.

The `#status` channel can link to the website's live status page at `/status` (JSON at `/api/status`).
