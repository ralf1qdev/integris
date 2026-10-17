import type { ActivityRange, AuditEventType, EventSource, ResourceType, Severity } from "@integris/shared";
import { Prisma, type AuditEvent } from "@prisma/client";
import { isUniqueViolation, type Db } from "../client";

export interface RecordEventInput {
  type: AuditEventType;
  source: EventSource;
  severity?: Severity;
  actorId?: string | null;
  actorName?: string | null;
  targetType?: ResourceType | null;
  targetId?: string | null;
  targetName?: string | null;
  summary: string;
  details?: Prisma.InputJsonValue;
  dedupKey?: string | null;
  occurredAt?: Date;
}

/** Records an audit event. Idempotent when a dedupKey is supplied. */
export async function recordEvent(db: Db, guildId: string, input: RecordEventInput): Promise<{ event: AuditEvent; created: boolean }> {
  try {
    const event = await db.auditEvent.create({
      data: {
        guildId,
        type: input.type,
        source: input.source,
        severity: input.severity ?? "INFO",
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        targetName: input.targetName ?? null,
        summary: input.summary,
        details: input.details ?? {},
        dedupKey: input.dedupKey ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
    return { event, created: true };
  } catch (err) {
    if (input.dedupKey && isUniqueViolation(err)) {
      const event = await db.auditEvent.findUniqueOrThrow({ where: { guildId_dedupKey: { guildId, dedupKey: input.dedupKey } } });
      return { event, created: false };
    }
    throw err;
  }
}

/**
 * Attaches an actor learned later (e.g. from the audit log) to the most recent
 * matching event that has none. Never overwrites a known actor.
 */
export async function attributeActor(
  db: Db,
  guildId: string,
  match: { types: AuditEventType[]; targetId: string; since: Date },
  actor: { id: string; name: string | null },
): Promise<boolean> {
  const event = await db.auditEvent.findFirst({
    where: { guildId, type: { in: match.types }, targetId: match.targetId, actorId: null, occurredAt: { gte: match.since } },
    orderBy: { occurredAt: "desc" },
  });
  if (!event) return false;
  await db.auditEvent.update({ where: { id: event.id }, data: { actorId: actor.id, actorName: actor.name } });
  return true;
}

export async function listEvents(
  db: Db,
  guildId: string,
  opts: { limit?: number; cursor?: string; targetType?: ResourceType; targetId?: string; types?: AuditEventType[] } = {},
) {
  const limit = Math.min(opts.limit ?? 50, 100);
  const rows = await db.auditEvent.findMany({
    where: {
      guildId,
      ...(opts.targetType ? { targetType: opts.targetType } : {}),
      ...(opts.targetId ? { targetId: opts.targetId } : {}),
      ...(opts.types ? { type: { in: opts.types } } : {}),
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null };
}

const RANGE: Record<ActivityRange, { bucket: "hour" | "day"; ms: number; buckets: number }> = {
  "24h": { bucket: "hour", ms: 3_600_000, buckets: 24 },
  "7d": { bucket: "day", ms: 86_400_000, buckets: 7 },
  "30d": { bucket: "day", ms: 86_400_000, buckets: 30 },
};

export interface ActivityPoint {
  bucket: string;
  events: number;
  alerts: number;
}

/** Real per-bucket counts of audit events and alerts. Empty buckets are zero, never synthesized. */
export async function activitySeries(db: Db, guildId: string, range: ActivityRange, now = new Date()): Promise<ActivityPoint[]> {
  const cfg = RANGE[range];
  const end = new Date(Math.floor(now.getTime() / cfg.ms) * cfg.ms + cfg.ms);
  const start = new Date(end.getTime() - cfg.ms * cfg.buckets);
  const unit = Prisma.raw(`'${cfg.bucket}'`);

  const [events, alerts] = await Promise.all([
    db.$queryRaw<{ b: Date; n: bigint }[]>`
      SELECT date_trunc(${unit}, "occurredAt") AS b, count(*)::bigint AS n
      FROM "AuditEvent" WHERE "guildId" = ${guildId} AND "occurredAt" >= ${start} AND "occurredAt" < ${end}
      GROUP BY 1`,
    db.$queryRaw<{ b: Date; n: bigint }[]>`
      SELECT date_trunc(${unit}, "createdAt") AS b, count(*)::bigint AS n
      FROM "SecurityAlert" WHERE "guildId" = ${guildId} AND "createdAt" >= ${start} AND "createdAt" < ${end}
      GROUP BY 1`,
  ]);

  const key = (d: Date) => new Date(Math.floor(new Date(d).getTime() / cfg.ms) * cfg.ms).toISOString();
  const eventMap = new Map(events.map((r) => [key(r.b), Number(r.n)]));
  const alertMap = new Map(alerts.map((r) => [key(r.b), Number(r.n)]));
  return Array.from({ length: cfg.buckets }, (_, i) => {
    const bucket = new Date(start.getTime() + i * cfg.ms).toISOString();
    return { bucket, events: eventMap.get(bucket) ?? 0, alerts: alertMap.get(bucket) ?? 0 };
  });
}
