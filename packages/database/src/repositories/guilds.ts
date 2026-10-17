import type { Db } from "../client";

export async function upsertGuildFromGateway(
  db: Db,
  g: { id: string; name: string; icon: string | null; ownerId: string | null },
  now = new Date(),
) {
  const existing = await db.guild.findUnique({ where: { id: g.id } });
  const reinstalled = !existing || !existing.botPresent;
  const guild = await db.guild.upsert({
    where: { id: g.id },
    create: { ...g, botPresent: true, installedAt: now },
    update: {
      name: g.name,
      icon: g.icon,
      ownerId: g.ownerId,
      botPresent: true,
      ...(reinstalled ? { installedAt: now, removedAt: null } : {}),
    },
  });
  await db.guildSettings.upsert({ where: { guildId: g.id }, create: { guildId: g.id }, update: {} });
  return { guild, reinstalled };
}

export async function markGuildRemoved(db: Db, guildId: string, now = new Date()) {
  await db.guild.updateMany({ where: { id: guildId }, data: { botPresent: false, removedAt: now } });
  // Access caches are dropped so no one keeps a stale grant.
  await db.guildAccess.deleteMany({ where: { guildId } });
}

export async function getInstalledGuildIds(db: Db): Promise<string[]> {
  const rows = await db.guild.findMany({ where: { botPresent: true }, select: { id: true } });
  return rows.map((r) => r.id);
}
