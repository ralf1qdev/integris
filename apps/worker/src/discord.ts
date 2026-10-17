import { DiscordAPIError, REST } from "@discordjs/rest";
import { Routes, type APIAuditLog, type APIChannel, type APIGuild, type APIGuildMember, type APIRole, type APIUser } from "discord-api-types/v10";
import { toSafeWebhook, type RawDiscordWebhook, type SafeWebhook } from "@integris/shared";
import { env } from "./env";
import { log } from "./log";

/**
 * Bot-token REST client. @discordjs/rest tracks per-route rate-limit buckets,
 * honours 429 retry-after and the global limit, and retries transient 5xx errors.
 */
export const rest = new REST({ version: "10", retries: 3, timeout: 15_000 }).setToken(env.DISCORD_BOT_TOKEN);

rest.on("rateLimited", (info) => {
  log.warn({ route: info.route, retryAfter: info.retryAfter, global: info.global }, "discord rate limited");
});

export const DiscordError = {
  UnknownGuild: 10004,
  UnknownChannel: 10003,
  UnknownMember: 10007,
  UnknownWebhook: 10015,
  MissingAccess: 50001,
  MissingPermissions: 50013,
} as const;

export function discordCode(err: unknown): number | null {
  return err instanceof DiscordAPIError && typeof err.code === "number" ? err.code : null;
}

export function isAccessError(err: unknown): boolean {
  const code = discordCode(err);
  return code === DiscordError.MissingAccess || code === DiscordError.MissingPermissions || (err instanceof DiscordAPIError && err.status === 403);
}

export const getGuild = (id: string) => rest.get(Routes.guild(id)) as Promise<APIGuild>;
export const getRoles = (id: string) => rest.get(Routes.guildRoles(id)) as Promise<APIRole[]>;
export const getChannels = (id: string) => rest.get(Routes.guildChannels(id)) as Promise<APIChannel[]>;
export const getChannel = (id: string) => rest.get(Routes.channel(id)) as Promise<APIChannel>;
export const getMember = (guildId: string, userId: string) => rest.get(Routes.guildMember(guildId, userId)) as Promise<APIGuildMember>;
export const getSelf = () => rest.get(Routes.user()) as Promise<APIUser>;

/** Lists all members (requires the Server Members privileged intent) and keeps bot accounts. */
export async function listBotMembers(guildId: string, maxPages = 200): Promise<APIGuildMember[]> {
  const bots: APIGuildMember[] = [];
  let after = "0";
  for (let page = 0; page < maxPages; page++) {
    const batch = (await rest.get(Routes.guildMembers(guildId), {
      query: new URLSearchParams({ limit: "1000", after }),
    })) as APIGuildMember[];
    for (const m of batch) if (m.user?.bot) bots.push(m);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1]!.user!.id;
  }
  return bots;
}

/** Webhook listing. Tokens are stripped immediately and never leave this function. */
export async function listGuildWebhooks(guildId: string): Promise<SafeWebhook[]> {
  const raw = (await rest.get(Routes.guildWebhooks(guildId))) as RawDiscordWebhook[];
  return raw.map(toSafeWebhook);
}

export async function listChannelWebhooks(channelId: string): Promise<SafeWebhook[]> {
  const raw = (await rest.get(Routes.channelWebhooks(channelId))) as RawDiscordWebhook[];
  return raw.map(toSafeWebhook);
}

export async function getAuditLog(guildId: string, actionType: number, limit = 25): Promise<APIAuditLog | null> {
  try {
    return (await rest.get(Routes.guildAuditLog(guildId), {
      query: new URLSearchParams({ action_type: String(actionType), limit: String(limit) }),
    })) as APIAuditLog;
  } catch (err) {
    if (isAccessError(err)) return null; // View Audit Log not granted: actors stay "Unknown".
    throw err;
  }
}

export async function leaveGuild(guildId: string) {
  await rest.delete(Routes.userGuild(guildId));
}

export async function deleteWebhookById(webhookId: string, reason: string) {
  await rest.delete(Routes.webhook(webhookId), { reason });
}
