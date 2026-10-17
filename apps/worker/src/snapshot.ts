import { persistChannels, persistRoles, toChannelInfo, toRoleInfo } from "./context";
import { getChannels, getGuild } from "./discord";
import type { GuildContext } from "@integris/security";
import { db } from "./state";

/** Fetches the guild, its roles and channels from Discord and stores the snapshot. */
export async function refreshGuildSnapshot(guildId: string): Promise<GuildContext> {
  const [guild, rawChannels] = await Promise.all([getGuild(guildId), getChannels(guildId)]);
  await db.guild.update({ where: { id: guildId }, data: { name: guild.name, icon: guild.icon, ownerId: guild.owner_id } });
  const roles = guild.roles.map(toRoleInfo);
  const channels = rawChannels.map(toChannelInfo);
  await persistRoles(db, guildId, roles, new Map(guild.roles.map((r) => [r.id, r.color])));
  await persistChannels(db, guildId, channels);
  return { guildId, ownerId: guild.owner_id, roles, channels };
}

export function channelNameMap(ctx: GuildContext): Map<string, string> {
  return new Map(ctx.channels.map((c) => [c.id, c.name]));
}
