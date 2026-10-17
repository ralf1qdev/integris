import type { GuildSettingsUpdate } from "@integris/shared";
import type { GuildSettings } from "@prisma/client";
import type { Db } from "../client";
import { recordEvent } from "./events";

export async function getSettings(db: Db, guildId: string): Promise<GuildSettings> {
  return db.guildSettings.upsert({ where: { guildId }, create: { guildId }, update: {} });
}

/**
 * Updates settings after validating channel references belong to this guild.
 * Returns an error when a referenced channel or role is not part of the guild.
 */
export async function updateSettings(
  db: Db,
  guildId: string,
  patch: GuildSettingsUpdate,
  actor: { id: string; name: string | null; source: "DASHBOARD" | "COMMAND" },
): Promise<GuildSettings | { error: "UNKNOWN_CHANNEL" | "UNKNOWN_ROLE" }> {
  const channelIds = [...(patch.restrictedChannelIds ?? []), ...(patch.alertChannelId ? [patch.alertChannelId] : [])];
  if (channelIds.length) {
    const found = await db.guildChannel.count({ where: { guildId, id: { in: channelIds } } });
    if (found !== new Set(channelIds).size) return { error: "UNKNOWN_CHANNEL" };
  }
  if (patch.alertMentionRoleId) {
    // @everyone (id === guildId) and managed bot roles are never valid mention targets.
    const role = await db.guildRole.findFirst({ where: { id: patch.alertMentionRoleId, guildId, managed: false, NOT: { id: guildId } } });
    if (!role) return { error: "UNKNOWN_ROLE" };
  }
  await getSettings(db, guildId);
  const settings = await db.guildSettings.update({
    where: { guildId },
    data: {
      ...patch,
      ...(patch.restrictedChannelIds ? { restrictedChannelIds: [...new Set(patch.restrictedChannelIds)] } : {}),
      ...(patch.alertChannelId ? { setupCompletedAt: new Date() } : {}),
      updatedById: actor.id,
    },
  });
  await recordEvent(db, guildId, {
    type: "SETTINGS_UPDATED",
    source: actor.source,
    actorId: actor.id,
    actorName: actor.name,
    targetType: "GUILD",
    targetId: guildId,
    summary: `Settings updated: ${Object.keys(patch).join(", ")}`,
    details: { changed: Object.keys(patch) },
  });
  return settings;
}
