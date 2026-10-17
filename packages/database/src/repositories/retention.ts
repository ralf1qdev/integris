import type { Db } from "../client";

const DAY = 86_400_000;

/**
 * Applies each guild's retention period. Active data (open findings/alerts,
 * present inventory) is never purged — only history older than the cutoff.
 */
export async function purgeExpiredData(db: Db, now = new Date()) {
  const settings = await db.guildSettings.findMany({ select: { guildId: true, retentionDays: true } });
  let removed = 0;
  for (const s of settings) {
    const cutoff = new Date(now.getTime() - s.retentionDays * DAY);
    const results = await Promise.all([
      db.auditEvent.deleteMany({ where: { guildId: s.guildId, occurredAt: { lt: cutoff } } }),
      db.securityAlert.deleteMany({ where: { guildId: s.guildId, status: "RESOLVED", resolvedAt: { lt: cutoff } } }),
      db.securityFinding.deleteMany({ where: { guildId: s.guildId, status: "RESOLVED", resolvedAt: { lt: cutoff } } }),
      db.scanJob.deleteMany({ where: { guildId: s.guildId, createdAt: { lt: cutoff } } }),
      db.webhookInventory.deleteMany({ where: { guildId: s.guildId, status: "DELETED", deletedAt: { lt: cutoff } } }),
      db.botInventory.deleteMany({ where: { guildId: s.guildId, isPresent: false, removedAt: { lt: cutoff } } }),
    ]);
    removed += results.reduce((n, r) => n + r.count, 0);
  }
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  // Guilds that removed Integris more than 30 days ago are erased entirely.
  const abandoned = await db.guild.deleteMany({ where: { botPresent: false, removedAt: { lt: new Date(now.getTime() - 30 * DAY) } } });
  return { removed, sessions: sessions.count, abandonedGuilds: abandoned.count };
}

/** Permanently removes every record for a guild (cascades) and keeps an audit log entry. */
export async function deleteGuildData(db: Db, input: { guildId: string; requestedById: string; leftGuild: boolean }) {
  const guild = await db.guild.findUnique({ where: { id: input.guildId } });
  if (!guild) return null;
  const log = await db.dataDeletionLog.create({
    data: { guildId: guild.id, guildName: guild.name, requestedById: input.requestedById, leftGuild: input.leftGuild },
  });
  await db.guild.delete({ where: { id: guild.id } });
  return db.dataDeletionLog.update({ where: { id: log.id }, data: { completedAt: new Date() } });
}
