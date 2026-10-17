import type { AlertDraft } from "@integris/security";
import type { AlertStatus, EventSource, Severity } from "@integris/shared";
import type { SecurityAlert } from "@prisma/client";
import type { Db } from "../client";
import { recordEvent } from "./events";

export interface RaiseAlertResult {
  alert: SecurityAlert;
  created: boolean;
}

/**
 * Creates an alert unless an equivalent one is still active or was raised within
 * the cooldown window. Suppressed repeats increment `occurrences` instead of
 * producing another Discord notification.
 */
export async function raiseAlert(
  db: Db,
  guildId: string,
  draft: AlertDraft & { findingId?: string | null },
  opts: { cooldownMinutes: number; now?: Date },
): Promise<RaiseAlertResult> {
  const now = opts.now ?? new Date();
  const latest = await db.securityAlert.findFirst({
    where: { guildId, dedupKey: draft.dedupKey },
    orderBy: { createdAt: "desc" },
  });

  if (latest) {
    const active = latest.status !== "RESOLVED";
    const withinCooldown = now.getTime() - latest.lastOccurredAt.getTime() < opts.cooldownMinutes * 60_000;
    if (active || withinCooldown) {
      const alert = await db.securityAlert.update({
        where: { id: latest.id },
        data: { occurrences: { increment: 1 }, lastOccurredAt: now },
      });
      return { alert, created: false };
    }
  }

  const alert = await db.securityAlert.create({
    data: {
      guildId,
      findingId: draft.findingId ?? null,
      dedupKey: draft.dedupKey,
      severity: draft.severity,
      title: draft.title,
      description: draft.description,
      recommendation: draft.recommendation,
      resourceType: draft.resourceType,
      resourceId: draft.resourceId,
      resourceName: draft.resourceName,
      evidence: draft.evidence,
      createdAt: now,
      lastOccurredAt: now,
    },
  });
  return { alert, created: true };
}

const STATUS_EVENT = {
  ACKNOWLEDGED: "ALERT_ACKNOWLEDGED",
  RESOLVED: "ALERT_RESOLVED",
  OPEN: "ALERT_REOPENED",
} as const;

/**
 * Changes an alert's status. The guildId is part of the WHERE clause, so an alert
 * ID from another guild can never be modified. Returns null when not found.
 */
export async function setAlertStatus(
  db: Db,
  input: { guildId: string; alertId: string; status: AlertStatus; actorId: string; actorName: string | null; source: EventSource },
): Promise<SecurityAlert | null> {
  const now = new Date();
  const data =
    input.status === "ACKNOWLEDGED"
      ? { status: input.status, acknowledgedAt: now, acknowledgedById: input.actorId }
      : input.status === "RESOLVED"
        ? { status: input.status, resolvedAt: now, resolvedById: input.actorId }
        : { status: input.status, resolvedAt: null, resolvedById: null, acknowledgedAt: null, acknowledgedById: null };

  const { count } = await db.securityAlert.updateMany({ where: { id: input.alertId, guildId: input.guildId }, data });
  if (count === 0) return null;
  const alert = await db.securityAlert.findUniqueOrThrow({ where: { id: input.alertId } });
  await recordEvent(db, input.guildId, {
    type: STATUS_EVENT[input.status],
    source: input.source,
    actorId: input.actorId,
    actorName: input.actorName,
    targetType: alert.resourceType,
    targetId: alert.resourceId,
    targetName: alert.resourceName,
    summary: `Alert "${alert.title}" ${input.status === "OPEN" ? "reopened" : input.status.toLowerCase()}`,
    details: { alertId: alert.id },
  });
  return alert;
}

export async function getAlert(db: Db, guildId: string, alertId: string) {
  return db.securityAlert.findFirst({ where: { id: alertId, guildId } });
}

export async function listAlerts(
  db: Db,
  guildId: string,
  opts: { status?: AlertStatus[]; severity?: Severity[]; limit?: number; cursor?: string } = {},
) {
  const limit = Math.min(opts.limit ?? 50, 100);
  const rows = await db.securityAlert.findMany({
    where: {
      guildId,
      ...(opts.status ? { status: { in: opts.status } } : {}),
      ...(opts.severity ? { severity: { in: opts.severity } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null };
}

export async function markAlertDelivered(db: Db, alertId: string, delivery: { channelId: string; messageId: string }) {
  await db.securityAlert.update({
    where: { id: alertId },
    data: { deliveredAt: new Date(), deliveryChannelId: delivery.channelId, deliveryMessageId: delivery.messageId, deliveryError: null },
  });
}

export async function markAlertDeliveryFailed(db: Db, alertId: string, error: string) {
  await db.securityAlert.update({ where: { id: alertId }, data: { deliveryError: error.slice(0, 500) } });
}
