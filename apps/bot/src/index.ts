import { Client, Events, GatewayIntentBits, Options } from "discord.js";
import { env } from "./env";
import { reconcileGuildMembership, registerGuildEvents } from "./events/guilds";
import { registerMonitoringEvents } from "./events/monitoring";
import { handleInteraction } from "./interactions";
import { db, eventQueue, log, scanQueue } from "./runtime";

/**
 * Intents (least privilege; no message content):
 *  - Guilds:             guild, role and channel lifecycle
 *  - GuildMembers:       bot joins/leaves/role changes (privileged — enable in the Developer Portal)
 *  - GuildModeration:    audit-log entry events, for actor attribution
 *  - GuildWebhooks:      "webhooks changed in channel X" notifications
 *  - GuildIntegrations:  integration changes
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildIntegrations,
  ],
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 0,
    PresenceManager: 0,
    ReactionManager: 0,
    // Keep only bot members (and Integris itself) cached; humans are not needed.
    GuildMemberManager: { maxSize: 10_000, keepOverLimit: (m) => m.user.bot },
  }),
  allowedMentions: { parse: [] },
});

registerGuildEvents(client);
registerMonitoringEvents(client);
client.on(Events.InteractionCreate, (i) => void handleInteraction(i));

client.once(Events.ClientReady, async (c) => {
  log.info({ user: c.user.tag, guilds: c.guilds.cache.size }, "bot connected");
  await reconcileGuildMembership(c).catch((err) => log.error({ err }, "membership reconciliation failed"));
});
client.on(Events.ShardResume, (id, replayed) => log.info({ shard: id, replayed }, "gateway session resumed"));
client.on(Events.ShardDisconnect, (_e, id) => log.warn({ shard: id }, "gateway disconnected"));
client.on(Events.Error, (err) => log.error({ err }, "client error"));

async function shutdown(signal: string) {
  log.info({ signal }, "bot shutting down");
  await client.destroy();
  await Promise.allSettled([scanQueue.close(), eventQueue.close(), db.$disconnect()]);
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(env.DISCORD_BOT_TOKEN);
