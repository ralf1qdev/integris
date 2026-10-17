/**
 * Discord helpers that are safe to use in any runtime (browser included).
 */

/**
 * Least-privilege permissions Integris requests when invited:
 *  - View Audit Log     (1 << 7)   attribute changes to an actor where Discord records one
 *  - View Channels      (1 << 10)  see channels and their permission overwrites
 *  - Send Messages      (1 << 11)  deliver alerts to the configured channel
 *  - Embed Links        (1 << 14)  render alert embeds
 *  - Manage Webhooks    (1 << 29)  Discord only lists webhooks to members with this
 *                                  permission; also needed for the emergency delete action
 */
export const INTEGRIS_BOT_PERMISSIONS = (
  (1n << 7n) | (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 29n)
).toString();

export const DISCORD_API = "https://discord.com/api/v10";
const CDN = "https://cdn.discordapp.com";

export function buildBotInviteUrl(clientId: string, guildId?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "bot applications.commands",
    permissions: INTEGRIS_BOT_PERMISSIONS,
  });
  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export function userAvatarUrl(userId: string, avatar: string | null | undefined, size = 64): string {
  if (avatar) {
    const ext = avatar.startsWith("a_") ? "gif" : "png";
    return `${CDN}/avatars/${userId}/${avatar}.${ext}?size=${size}`;
  }
  // Default avatars for the new username system: (id >> 22) % 6
  const index = Number((BigInt(userId) >> 22n) % 6n);
  return `${CDN}/embed/avatars/${index}.png`;
}

export function guildIconUrl(guildId: string, icon: string | null | undefined, size = 64): string | null {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `${CDN}/icons/${guildId}/${icon}.${ext}?size=${size}`;
}

export function webhookAvatarUrl(webhookId: string, avatar: string | null | undefined, size = 64): string | null {
  if (!avatar) return null;
  return `${CDN}/avatars/${webhookId}/${avatar}.png?size=${size}`;
}

const DISCORD_EPOCH = 1420070400000n;
export function snowflakeToDate(id: string): Date {
  return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
}

/** Raw webhook as returned by the Discord REST API. Contains secrets. */
export interface RawDiscordWebhook {
  id: string;
  type: number;
  guild_id?: string | null;
  channel_id: string | null;
  name: string | null;
  avatar: string | null;
  application_id: string | null;
  user?: { id: string; username: string; global_name?: string | null; bot?: boolean } | null;
  token?: string;
  url?: string;
  source_guild?: { id: string; name: string } | null;
  source_channel?: { id: string; name: string } | null;
}

/** Webhook shape Integris is allowed to keep. Tokens and URLs are dropped here and never stored. */
export interface SafeWebhook {
  id: string;
  type: number;
  channelId: string | null;
  name: string | null;
  avatar: string | null;
  applicationId: string | null;
  creatorId: string | null;
  creatorName: string | null;
  creatorIsBot: boolean | null;
  sourceGuildName: string | null;
  sourceChannelName: string | null;
}

export function toSafeWebhook(raw: RawDiscordWebhook): SafeWebhook {
  return {
    id: raw.id,
    type: raw.type,
    channelId: raw.channel_id ?? null,
    name: raw.name ?? null,
    avatar: raw.avatar ?? null,
    applicationId: raw.application_id ?? null,
    creatorId: raw.user?.id ?? null,
    creatorName: raw.user ? (raw.user.global_name ?? raw.user.username) : null,
    creatorIsBot: raw.user ? Boolean(raw.user.bot) : null,
    sourceGuildName: raw.source_guild?.name ?? null,
    sourceChannelName: raw.source_channel?.name ?? null,
  };
}

/** Audit log action types Integris reads. https://discord.com/developers/docs/resources/audit-log */
export const AuditLogAction = {
  ChannelOverwriteCreate: 13,
  ChannelOverwriteUpdate: 14,
  ChannelOverwriteDelete: 15,
  MemberRoleUpdate: 25,
  BotAdd: 28,
  RoleCreate: 30,
  RoleUpdate: 31,
  RoleDelete: 32,
  WebhookCreate: 50,
  WebhookUpdate: 51,
  WebhookDelete: 52,
  IntegrationCreate: 80,
  IntegrationUpdate: 81,
  IntegrationDelete: 82,
} as const;
