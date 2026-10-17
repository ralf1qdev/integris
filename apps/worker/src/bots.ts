import {
  getTrustMap,
  recordEvent,
  syncFindings,
  type Db,
  type GuildSettings,
} from "@integris/database";
import {
  analyseEscalation,
  botEscalationAlert,
  DANGEROUS_PERMISSIONS,
  evaluateBot,
  has,
  label,
  Permission,
  toBits,
  type FindingDraft,
  type GuildContext,
} from "@integris/security";
import { maxSeverity, severityAtLeast, type EventSource, type Severity } from "@integris/shared";
import type { APIGuildMember } from "discord-api-types/v10";
import { emitAlert } from "./alerting";

const VERIFIED_BOT_FLAG = 1 << 16;

export interface BotObservation {
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  roleIds: string[];
  verified: boolean | null;
  joinedAt: Date | null;
}

export function observeMember(m: APIGuildMember): BotObservation {
  const u = m.user!;
  const flags = u.public_flags ?? u.flags;
  return {
    userId: u.id,
    username: u.username,
    globalName: u.global_name ?? null,
    avatar: u.avatar ?? null,
    roleIds: m.roles,
    verified: typeof flags === "number" ? (flags & VERIFIED_BOT_FLAG) !== 0 : null,
    joinedAt: m.joined_at ? new Date(m.joined_at) : null,
  };
}

export interface ApplyBotsOptions {
  ctx: GuildContext;
  settings: GuildSettings;
  selfId: string;
  source: EventSource;
  /** First scan after install: record inventory without "added" events or join alerts. */
  baseline: boolean;
  /** Bot IDs that were evaluated, or ALL. */
  scope: "ALL" | string[];
  /** Whether scoped bots missing from `observed` have left the guild. Defaults to scope === "ALL". */
  missingMeansRemoved?: boolean;
  cause?: string;
  resolveAdder?: (botId: string) => Promise<{ id: string; name: string | null } | null>;
  now?: Date;
}

export type ApplyBotsResult = {
  added: string[];
  removed: string[];
  permissionChanges: string[];
  findings: number;
};

const riskSeverity = (r: string): Severity => (r === "NONE" ? "INFO" : (r as Severity));

function elevatedLabels(bits: bigint): string[] {
  if (has(bits, Permission.Administrator)) return ["Administrator"];
  return DANGEROUS_PERMISSIONS.filter((d) => has(bits, d.flag)).map((d) => label(d.name));
}

/**
 * Applies observed bot state to the inventory: detects joins, departures and
 * permission changes, records events, syncs findings and raises alerts.
 * Shared by full reconciliation scans and targeted Gateway event handling.
 */
export async function applyBots(db: Db, guildId: string, observed: BotObservation[], opts: ApplyBotsOptions): Promise<ApplyBotsResult> {
  const now = opts.now ?? new Date();
  const { settings } = opts;
  const trust = await getTrustMap(db, guildId, "BOT");
  const existing = await db.botInventory.findMany({
    where: { guildId, ...(opts.scope === "ALL" ? {} : { botUserId: { in: opts.scope } }) },
  });
  const prevById = new Map(existing.map((b) => [b.botUserId, b]));
  const result: ApplyBotsResult = { added: [], removed: [], permissionChanges: [], findings: 0 };
  const allFindings: FindingDraft[] = [];
  const addedNow = new Set<string>();
  const observedIds = new Set(observed.map((o) => o.userId));

  for (const obs of observed) {
    const isSelf = obs.userId === opts.selfId;
    const evaluation = evaluateBot(opts.ctx, { userId: obs.userId, username: obs.globalName ?? obs.username, roleIds: obs.roleIds, verified: obs.verified });
    const findings = isSelf ? [] : evaluation.findings;
    allFindings.push(...findings);
    const prev = prevById.get(obs.userId);
    const permissions = evaluation.permissions.toString();
    const displayName = obs.globalName ?? obs.username;

    const fields = {
      username: obs.username,
      globalName: obs.globalName,
      avatar: obs.avatar,
      verified: obs.verified,
      isIntegris: isSelf,
      roleIds: obs.roleIds,
      highestRoleId: evaluation.highestRole?.id ?? null,
      highestRoleName: evaluation.highestRole?.name ?? null,
      highestRolePosition: evaluation.highestRole?.position ?? null,
      permissions,
      isAdministrator: evaluation.isAdministrator,
      channelElevations: evaluation.channelElevations.map((e) => ({ ...e })),
      riskLevel: isSelf ? ("NONE" as const) : evaluation.riskLevel,
      isPresent: true,
      removedAt: null,
      lastSeenAt: now,
      joinedAt: obs.joinedAt,
    };
    await db.botInventory.upsert({
      where: { guildId_botUserId: { guildId, botUserId: obs.userId } },
      create: { guildId, botUserId: obs.userId, firstSeenAt: now, ...fields },
      update: fields,
    });

    const target = { targetType: "BOT" as const, targetId: obs.userId, targetName: displayName };

    if (!prev?.isPresent && !opts.baseline) {
      result.added.push(obs.userId);
      addedNow.add(obs.userId);
      const adder = (await opts.resolveAdder?.(obs.userId)) ?? null;
      const severity = maxSeverity(findings.map((f) => f.severity)) ?? "INFO";
      const joinKey = obs.joinedAt?.getTime() ?? Math.floor(now.getTime() / 60_000);
      await recordEvent(db, guildId, {
        type: "BOT_ADDED",
        source: opts.source,
        severity,
        actorId: adder?.id ?? null,
        actorName: adder?.name ?? null,
        ...target,
        summary: `New bot detected: ${displayName}`,
        details: { elevatedPermissions: elevatedLabels(evaluation.permissions), verifiedBot: obs.verified, highestRole: evaluation.highestRole?.name ?? null },
        dedupKey: `bot-added:${obs.userId}:${joinKey}`,
        occurredAt: obs.joinedAt ?? now,
      });
      await db.botInventory.update({
        where: { guildId_botUserId: { guildId, botUserId: obs.userId } },
        data: { addedById: adder?.id ?? null, addedByName: adder?.name ?? null, lastEventAt: now, lastEventSummary: "Joined the server" },
      });
      if (settings.alertOnBotJoin && !isSelf) {
        const sev = maxSeverity(["MEDIUM", riskSeverity(evaluation.riskLevel)] as Severity[])!;
        await emitAlert(db, guildId, settings, {
          dedupKey: `bot-added:${obs.userId}:${joinKey}`,
          severity: sev,
          title: "New bot detected",
          description: `${displayName} joined the server.${findings.length ? ` Integris found ${findings.length} permission finding(s) for it.` : ""}`,
          recommendation: findings.length
            ? "Confirm the bot was added intentionally and that it needs the permissions listed. Mark it as trusted once reviewed."
            : "Confirm the bot was added intentionally. Mark it as trusted once reviewed.",
          resourceType: "BOT",
          resourceId: obs.userId,
          resourceName: displayName,
          evidence: {
            addedBy: adder?.name ?? adder?.id ?? "Unknown",
            verifiedBot: obs.verified === null ? "Unknown" : obs.verified ? "Yes" : "No",
            highestRole: evaluation.highestRole?.name ?? "None",
            elevatedPermissions: elevatedLabels(evaluation.permissions),
          },
        });
      }
      continue;
    }

    if (prev?.isPresent && prev.permissions !== permissions) {
      result.permissionChanges.push(obs.userId);
      const esc = analyseEscalation(prev.permissions, permissions);
      const cause = opts.cause ?? "Its roles or role permissions changed.";
      await recordEvent(db, guildId, {
        type: "BOT_PERMISSIONS_CHANGED",
        source: opts.source,
        severity: esc.dangerousGained.length ? "MEDIUM" : "INFO",
        ...target,
        summary: `Bot role permissions changed: ${displayName}`,
        details: { gained: esc.gained.map(label), lost: esc.lost.map(label), cause },
        occurredAt: now,
      });
      await db.botInventory.update({
        where: { guildId_botUserId: { guildId, botUserId: obs.userId } },
        data: { lastEventAt: now, lastEventSummary: "Permissions changed" },
      });

      const trusted = trust.get(obs.userId);
      const withinTrustedSnapshot =
        trusted?.permissionsSnapshot != null && (toBits(permissions) & ~toBits(trusted.permissionsSnapshot)) === 0n;
      const alert = isSelf || withinTrustedSnapshot
        ? null
        : botEscalationAlert({ botId: obs.userId, botName: displayName, before: prev.permissions, after: permissions, trusted: Boolean(trusted), cause });
      if (alert) {
        await recordEvent(db, guildId, {
          type: "PERMISSION_ESCALATION",
          source: opts.source,
          severity: alert.severity,
          ...target,
          summary: `Suspicious permission escalation: ${displayName} gained ${esc.dangerousGained.map(label).join(", ")}`,
          details: alert.evidence,
          occurredAt: now,
        });
        if (settings.alertOnPermissionEscalation) await emitAlert(db, guildId, settings, alert);
      }
    }
  }

  const missingMeansRemoved = opts.missingMeansRemoved ?? opts.scope === "ALL";
  if (missingMeansRemoved) {
    for (const prev of existing) {
      if (!prev.isPresent || observedIds.has(prev.botUserId)) continue;
      result.removed.push(prev.botUserId);
      await db.botInventory.update({
        where: { id: prev.id },
        data: { isPresent: false, removedAt: now, lastEventAt: now, lastEventSummary: "Left the server" },
      });
      await recordEvent(db, guildId, {
        type: "BOT_REMOVED",
        source: opts.source,
        targetType: "BOT",
        targetId: prev.botUserId,
        targetName: prev.globalName ?? prev.username,
        summary: `Bot removed: ${prev.globalName ?? prev.username}`,
        dedupKey: `bot-removed:${prev.botUserId}:${Math.floor(now.getTime() / 60_000)}`,
        occurredAt: now,
      });
    }
  }

  const scopeIds = opts.scope === "ALL" ? "ALL" : opts.scope;
  const synced = await syncFindings(db, guildId, allFindings, [{ targetType: "BOT", targetIds: scopeIds }], now);
  result.findings = allFindings.length;

  for (const { finding, transition } of synced.upserted) {
    if (transition !== "created" && transition !== "reopened") continue;
    if (addedNow.has(finding.targetId) || trust.has(finding.targetId)) continue;
    const threshold: Severity = opts.baseline ? "HIGH" : "MEDIUM";
    if (!severityAtLeast(finding.severity, threshold)) continue;
    await emitAlert(
      db,
      guildId,
      settings,
      {
        dedupKey: `finding:${finding.fingerprint}`,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        recommendation: finding.recommendation,
        resourceType: "BOT",
        resourceId: finding.targetId,
        resourceName: finding.targetName,
        evidence: finding.evidence as Record<string, never>,
      },
      finding.id,
    );
  }
  return result;
}
