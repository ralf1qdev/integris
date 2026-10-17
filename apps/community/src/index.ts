import { Client, Events, GatewayIntentBits, MessageFlags, Partials, type Interaction } from "discord.js";
import { env } from "./env";
import { onMessage } from "./features/suggestions";
import { onPostCommand } from "./features/posts";
import { onTicketInteraction, TICKET_PREFIX } from "./features/tickets";
import { onMemberJoin } from "./features/welcome";
import { db, log } from "./runtime";
import { Server } from "./server";

/**
 * Community bot for the official Integris server. Intents: Guilds, GuildMembers
 * (privileged — welcome + Member role) and GuildMessages (to react in #suggestions).
 * It does not request the Message Content intent.
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.GuildMember],
  allowedMentions: { parse: [] },
});

let server: Server | null = null;
const forOurGuild = (guildId: string | null) => (server && guildId === server.guild.id ? server : null);

client.once(Events.ClientReady, async (c) => {
  const guild = c.guilds.cache.get(env.COMMUNITY_GUILD_ID);
  if (!guild) {
    log.error({ guildId: env.COMMUNITY_GUILD_ID }, "community bot is not in COMMUNITY_GUILD_ID — invite it first");
    return;
  }
  server = new Server(guild);
  server.reportMissing();
  log.info({ user: c.user.tag, guild: guild.name }, "community bot ready");
});

client.on(Events.GuildMemberAdd, (member) => {
  const s = forOurGuild(member.guild.id);
  if (s) void onMemberJoin(s, member).catch((err) => log.error({ err }, "welcome failed"));
});

client.on(Events.MessageCreate, (message) => {
  const s = forOurGuild(message.guildId);
  if (s) void onMessage(s, message);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.inCachedGuild()) return;
  const s = forOurGuild(interaction.guildId);
  if (!s) return;
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "post") return await onPostCommand(s, interaction);
    if ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith(TICKET_PREFIX)) return await onTicketInteraction(s, interaction);
  } catch (err) {
    log.error({ err }, "interaction failed");
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Something went wrong. Please try again.", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.on(Events.Error, (err) => log.error({ err }, "client error"));

async function shutdown(signal: string) {
  log.info({ signal }, "community bot shutting down");
  await client.destroy();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(env.COMMUNITY_BOT_TOKEN);
