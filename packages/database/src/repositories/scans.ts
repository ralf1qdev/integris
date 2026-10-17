import type { ScanTrigger } from "@integris/shared";
import type { ScanJob } from "@prisma/client";
import type { Db } from "../client";

/** A manual scan may be requested at most once per this interval per guild. */
export const MANUAL_SCAN_COOLDOWN_MS = 60_000;
/** A queued/running scan older than this is considered stuck and no longer blocks new scans. */
const STUCK_AFTER_MS = 15 * 60_000;

export type CreateScanResult =
  | { status: "created"; scan: ScanJob }
  | { status: "already_pending"; scan: ScanJob }
  | { status: "cooldown"; retryAfterMs: number };

export async function createScanJob(
  db: Db,
  input: { guildId: string; trigger: ScanTrigger; requestedById?: string | null; now?: Date },
): Promise<CreateScanResult> {
  const now = input.now ?? new Date();
  const pending = await db.scanJob.findFirst({
    where: { guildId: input.guildId, status: { in: ["QUEUED", "RUNNING"] }, createdAt: { gte: new Date(now.getTime() - STUCK_AFTER_MS) } },
    orderBy: { createdAt: "desc" },
  });
  if (pending) return { status: "already_pending", scan: pending };

  if (input.trigger === "DASHBOARD" || input.trigger === "COMMAND") {
    const recent = await db.scanJob.findFirst({
      where: { guildId: input.guildId, trigger: { in: ["DASHBOARD", "COMMAND"] }, createdAt: { gte: new Date(now.getTime() - MANUAL_SCAN_COOLDOWN_MS) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) return { status: "cooldown", retryAfterMs: MANUAL_SCAN_COOLDOWN_MS - (now.getTime() - recent.createdAt.getTime()) };
  }

  const scan = await db.scanJob.create({
    data: { guildId: input.guildId, trigger: input.trigger, requestedById: input.requestedById ?? null, createdAt: now },
  });
  return { status: "created", scan };
}

export async function getLatestScans(db: Db, guildId: string, take = 5) {
  return db.scanJob.findMany({ where: { guildId }, orderBy: { createdAt: "desc" }, take });
}
