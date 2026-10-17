import type { APIChannel, APIRole } from "discord-api-types/v10";
import type { ChannelInfo, GuildContext, OverwriteInfo, RoleInfo } from "@integris/security";
import type { Db } from "@integris/database";

export function toRoleInfo(r: APIRole): RoleInfo {
  return { id: r.id, name: r.name, position: r.position, permissions: r.permissions, managed: r.managed, botId: r.tags?.bot_id ?? null };
}

type GuildChannelLike = APIChannel & { name?: string; position?: number; parent_id?: string | null; permission_overwrites?: OverwriteInfo[] };

export function toChannelInfo(c: APIChannel): ChannelInfo & { position: number } {
  const ch = c as GuildChannelLike;
  return {
    id: ch.id,
    name: ch.name ?? "unknown",
    type: ch.type,
    parentId: ch.parent_id ?? null,
    position: ch.position ?? 0,
    permissionOverwrites: (ch.permission_overwrites ?? []).map((o) => ({ id: o.id, type: o.type, allow: String(o.allow), deny: String(o.deny) })),
  };
}

/** Replaces the stored role snapshot for one guild. */
export async function persistRoles(db: Db, guildId: string, roles: RoleInfo[], colors: Map<string, number> = new Map()) {
  for (const r of roles) {
    const data = { name: r.name, position: r.position, permissions: String(r.permissions), managed: r.managed, botId: r.botId ?? null, color: colors.get(r.id) ?? 0 };
    await db.guildRole.upsert({ where: { id: r.id }, create: { id: r.id, guildId, ...data }, update: { ...data, guildId } });
  }
  await db.guildRole.deleteMany({ where: { guildId, id: { notIn: roles.map((r) => r.id) } } });
}

/** Replaces the stored channel snapshot for one guild. */
export async function persistChannels(db: Db, guildId: string, channels: Array<ChannelInfo & { position: number }>) {
  for (const c of channels) {
    const data = { name: c.name, type: c.type, position: c.position, parentId: c.parentId ?? null, permissionOverwrites: c.permissionOverwrites as object[] };
    await db.guildChannel.upsert({ where: { id: c.id }, create: { id: c.id, guildId, ...data }, update: { ...data, guildId } });
  }
  await db.guildChannel.deleteMany({ where: { guildId, id: { notIn: channels.map((c) => c.id) } } });
}

export async function loadContextFromDb(db: Db, guildId: string): Promise<GuildContext> {
  const [guild, roles, channels] = await Promise.all([
    db.guild.findUniqueOrThrow({ where: { id: guildId } }),
    db.guildRole.findMany({ where: { guildId } }),
    db.guildChannel.findMany({ where: { guildId } }),
  ]);
  return {
    guildId,
    ownerId: guild.ownerId,
    roles: roles.map((r) => ({ id: r.id, name: r.name, position: r.position, permissions: r.permissions, managed: r.managed, botId: r.botId })),
    channels: channels.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
      permissionOverwrites: (c.permissionOverwrites as unknown as OverwriteInfo[]) ?? [],
    })),
  };
}
