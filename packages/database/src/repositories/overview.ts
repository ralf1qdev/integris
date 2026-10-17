import { computeSecurityScore } from "@integris/security/score";
import { SEVERITY_RANK } from "@integris/shared";
import type { Db } from "../client";

/** Everything the overview page needs, scoped to one guild. */
export async function getGuildOverview(db: Db, guildId: string) {
  const [botCount, adminBots, webhookCount, findings, openAlerts, recentEvents, latestScan, settings] = await Promise.all([
    db.botInventory.count({ where: { guildId, isPresent: true } }),
    db.botInventory.count({ where: { guildId, isPresent: true, isAdministrator: true } }),
    db.webhookInventory.count({ where: { guildId, status: "ACTIVE" } }),
    db.securityFinding.findMany({
      where: { guildId, status: { not: "RESOLVED" } },
      select: { id: true, severity: true, status: true, title: true, targetType: true, targetId: true, targetName: true, ruleId: true, lastSeenAt: true },
    }),
    db.securityAlert.groupBy({ by: ["severity"], where: { guildId, status: { not: "RESOLVED" } }, _count: { _all: true } }),
    db.auditEvent.findMany({ where: { guildId }, orderBy: { occurredAt: "desc" }, take: 8 }),
    db.scanJob.findFirst({ where: { guildId }, orderBy: { createdAt: "desc" } }),
    db.guildSettings.findUnique({ where: { guildId } }),
  ]);

  const score = computeSecurityScore(findings);
  const permissionRisks = findings
    .filter((f) => f.ruleId.startsWith("bot.") && f.severity !== "INFO")
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, 6);
  const activeAlerts = openAlerts.reduce((n, g) => n + g._count._all, 0);

  return {
    botCount,
    adminBots,
    webhookCount,
    activeAlerts,
    alertsBySeverity: Object.fromEntries(openAlerts.map((g) => [g.severity, g._count._all])),
    score,
    permissionRisks,
    openFindingCount: findings.filter((f) => f.severity !== "INFO").length,
    recentEvents,
    latestScan,
    alertChannelConfigured: Boolean(settings?.alertChannelId),
  };
}
