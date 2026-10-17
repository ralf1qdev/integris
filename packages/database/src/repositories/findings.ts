import { evidenceHash, findingFingerprint, type FindingDraft } from "@integris/security";
import { SEVERITY_RANK, type FindingStatus, type ResourceType } from "@integris/shared";
import type { SecurityFinding } from "@prisma/client";
import type { Db } from "../client";
import { recordEvent } from "./events";

export type FindingTransition = "created" | "reopened" | "changed" | "unchanged";

export interface FindingScope {
  targetType: ResourceType;
  /** Targets that were evaluated. "ALL" means every target of this type was evaluated. */
  targetIds: string[] | "ALL";
}

export interface SyncFindingsResult {
  upserted: { finding: SecurityFinding; transition: FindingTransition }[];
  autoResolved: SecurityFinding[];
}

/**
 * Reconciles rule output with stored findings for the evaluated scope:
 *  - new findings are created (OPEN);
 *  - findings that disappeared are auto-resolved;
 *  - findings that come back after auto-resolution are reopened;
 *  - a user-resolved finding that is still detected is reopened silently, because it was not fixed;
 *  - changed evidence updates the finding, and a severity increase re-opens acknowledged ones.
 */
export async function syncFindings(
  db: Db,
  guildId: string,
  drafts: FindingDraft[],
  scopes: FindingScope[],
  now = new Date(),
): Promise<SyncFindingsResult> {
  const result: SyncFindingsResult = { upserted: [], autoResolved: [] };
  const seen = new Set<string>();

  for (const d of drafts) {
    const fingerprint = findingFingerprint(d.ruleId, d.targetType, d.targetId);
    const hash = evidenceHash(d.evidence);
    seen.add(fingerprint);
    const existing = await db.securityFinding.findUnique({ where: { guildId_fingerprint: { guildId, fingerprint } } });
    const fields = {
      severity: d.severity,
      title: d.title,
      description: d.description,
      recommendation: d.recommendation,
      targetName: d.targetName,
      evidence: d.evidence,
      evidenceHash: hash,
      lastSeenAt: now,
    };

    if (!existing) {
      const finding = await db.securityFinding.create({
        data: { guildId, fingerprint, ruleId: d.ruleId, targetType: d.targetType, targetId: d.targetId, firstSeenAt: now, ...fields },
      });
      result.upserted.push({ finding, transition: "created" });
      continue;
    }

    const evidenceChanged = existing.evidenceHash !== hash;
    let status: FindingStatus = existing.status;
    let transition: FindingTransition = evidenceChanged ? "changed" : "unchanged";
    if (existing.status === "RESOLVED") {
      status = "OPEN";
      if (existing.autoResolved) transition = "reopened";
    } else if (existing.status === "ACKNOWLEDGED" && SEVERITY_RANK[d.severity] > SEVERITY_RANK[existing.severity]) {
      status = "OPEN";
    }

    const finding = await db.securityFinding.update({
      where: { id: existing.id },
      data: {
        ...fields,
        status,
        ...(status === "OPEN" && existing.status === "RESOLVED" ? { resolvedAt: null, autoResolved: false } : {}),
      },
    });
    result.upserted.push({ finding, transition });
  }

  for (const scope of scopes) {
    const stale = await db.securityFinding.findMany({
      where: {
        guildId,
        targetType: scope.targetType,
        status: { not: "RESOLVED" },
        ...(scope.targetIds === "ALL" ? {} : { targetId: { in: scope.targetIds } }),
      },
    });
    for (const f of stale) {
      if (seen.has(f.fingerprint)) continue;
      const resolved = await db.securityFinding.update({
        where: { id: f.id },
        data: { status: "RESOLVED", resolvedAt: now, autoResolved: true },
      });
      result.autoResolved.push(resolved);
    }
  }

  if (result.autoResolved.length) {
    await db.securityAlert.updateMany({
      where: { guildId, findingId: { in: result.autoResolved.map((f) => f.id) }, status: { not: "RESOLVED" } },
      data: { status: "RESOLVED", resolvedAt: now },
    });
  }
  return result;
}

export async function setFindingStatus(
  db: Db,
  input: { guildId: string; findingId: string; status: FindingStatus; actorId: string; actorName: string | null },
): Promise<SecurityFinding | null> {
  const { count } = await db.securityFinding.updateMany({
    where: { id: input.findingId, guildId: input.guildId },
    data: {
      status: input.status,
      statusChangedById: input.actorId,
      resolvedAt: input.status === "RESOLVED" ? new Date() : null,
      autoResolved: false,
    },
  });
  if (count === 0) return null;
  const finding = await db.securityFinding.findUniqueOrThrow({ where: { id: input.findingId } });
  await recordEvent(db, input.guildId, {
    type: "FINDING_STATUS_CHANGED",
    source: "DASHBOARD",
    actorId: input.actorId,
    actorName: input.actorName,
    targetType: finding.targetType,
    targetId: finding.targetId,
    targetName: finding.targetName,
    summary: `Finding "${finding.title}" marked ${input.status.toLowerCase()}`,
    details: { findingId: finding.id, status: input.status },
  });
  return finding;
}

export async function listFindings(
  db: Db,
  guildId: string,
  opts: { status?: FindingStatus[]; targetType?: ResourceType; targetId?: string } = {},
) {
  const rows = await db.securityFinding.findMany({
    where: {
      guildId,
      ...(opts.status ? { status: { in: opts.status } } : {}),
      ...(opts.targetType ? { targetType: opts.targetType } : {}),
      ...(opts.targetId ? { targetId: opts.targetId } : {}),
    },
    orderBy: [{ lastSeenAt: "desc" }],
    take: 500,
  });
  return rows.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}
