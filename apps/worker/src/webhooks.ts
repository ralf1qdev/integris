import { getTrustMap, recordEvent, syncFindings, type Db, type GuildSettings } from "@integris/database";
import {
  diffWebhooks,
  evaluateWebhook,
  webhookConfigHash,
  webhookCreatedAlert,
  webhookDeletedAlert,
  webhookUpdatedAlert,
  type FindingDraft,
  type WebhookContext,
} from "@integris/security";
import { AuditLogAction, severityAtLeast, type EventSource, type SafeWebhook } from "@integris/shared";
import { emitAlert } from "./alerting";
import { getAuditLog } from "./discord";

export type ActorLookup = (actionType: number, targetId: string) => Promise<{ id: string; name: string | null } | null>;

/**
 * Builds a per-pass audit-log lookup: one REST call per action type, reused for
 * every target. Returns null (shown as "Unknown") when Discord has no entry or
 * Integris cannot read the audit log.
 */
export function auditActorLookup(guildId: string, maxAgeMs = 10 * 60_000): ActorLookup {
  const cache = new Map<number, Promise<Awaited<ReturnType<typeof getAuditLog>>>>();
  return async (actionType, targetId) => {
    if (!cache.has(actionType)) cache.set(actionType, getAuditLog(guildId, actionType, 25));
    const logData = await cache.get(actionType)!;
    if (!logData) return null;
    const entry = logData.audit_log_entries.find((e) => e.target_id === targetId);
    if (!entry || !entry.user_id) return null;
    const ageMs = Date.now() - Number((BigInt(entry.id) >> 22n) + 1420070400000n);
    if (ageMs > maxAgeMs) return null;
    const user = logData.users.find((u) => u.id === entry.user_id);
    return { id: entry.user_id, name: user ? (user.global_name ?? user.username) : null };
  };
}

export interface ApplyWebhooksOptions {
  settings: GuildSettings;
  channelNames: Map<string, string>;
  source: EventSource;
  baseline: boolean;
  /** Channels whose webhooks were re-fetched. Omit for a full guild listing. */
  scopeChannelIds?: Set<string>;
  lookupActor?: ActorLookup;
  now?: Date;
}

export type ApplyWebhooksResult = {
  created: number;
  updated: number;
  deleted: number;
  active: number;
};

export async function applyWebhooks(db: Db, guildId: string, current: SafeWebhook[], opts: ApplyWebhooksOptions): Promise<ApplyWebhooksResult> {
  const now = opts.now ?? new Date();
  const { settings } = opts;
  const trust = await getTrustMap(db, guildId, "WEBHOOK");
  const restricted = new Set(settings.restrictedChannelIds);
  const stored = await db.webhookInventory.findMany({ where: { guildId, status: "ACTIVE" } });
  const diff = diffWebhooks(stored, current, opts.scopeChannelIds);
  const contextFor = (channelId: string | null, webhookId: string): WebhookContext => {
    const t = trust.get(webhookId);
    return {
      channelName: channelId ? (opts.channelNames.get(channelId) ?? null) : null,
      trust: t ? { protected: t.protected } : null,
      restrictedChannelIds: restricted,
    };
  };
  const createdIds = new Set(diff.created.map((w) => w.id));
  const updatedIds = new Set(diff.updated.map((u) => u.after.id));

  for (const w of current) {
    const channelName = w.channelId ? (opts.channelNames.get(w.channelId) ?? null) : null;
    const fields = {
      name: w.name,
      type: w.type,
      channelId: w.channelId,
      channelName,
      avatar: w.avatar,
      applicationId: w.applicationId,
      creatorId: w.creatorId,
      creatorName: w.creatorName,
      creatorIsBot: w.creatorIsBot,
      sourceGuildName: w.sourceGuildName,
      sourceChannelName: w.sourceChannelName,
      status: "ACTIVE" as const,
      configHash: webhookConfigHash(w),
      lastSeenAt: now,
      deletedAt: null,
    };
    await db.webhookInventory.upsert({
      where: { guildId_webhookId: { guildId, webhookId: w.id } },
      create: { guildId, webhookId: w.id, firstSeenAt: now, ...fields },
      update: {
        ...fields,
        ...(updatedIds.has(w.id) ? { lastChangedAt: now } : {}),
      },
    });
  }

  if (!opts.baseline) {
    for (const w of diff.created) {
      const ctx = contextFor(w.channelId, w.id);
      const actor = w.creatorId ? { id: w.creatorId, name: w.creatorName } : ((await opts.lookupActor?.(AuditLogAction.WebhookCreate, w.id)) ?? null);
      await recordEvent(db, guildId, {
        type: "WEBHOOK_CREATED",
        source: opts.source,
        severity: ctx.channelName && w.channelId && restricted.has(w.channelId) ? "HIGH" : "LOW",
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        targetType: "WEBHOOK",
        targetId: w.id,
        targetName: w.name,
        summary: `Webhook created: ${w.name ?? "Unnamed webhook"} in ${ctx.channelName ? `#${ctx.channelName}` : "Unknown channel"}`,
        details: { channelId: w.channelId, type: w.type },
        dedupKey: `webhook-created:${w.id}`,
        occurredAt: now,
      });
      const alert = webhookCreatedAlert(w, ctx, settings, actor?.name ?? null);
      if (alert) await emitAlert(db, guildId, settings, alert);
    }

    for (const u of diff.updated) {
      const ctx = contextFor(u.after.channelId, u.after.id);
      const actor = (await opts.lookupActor?.(AuditLogAction.WebhookUpdate, u.after.id)) ?? null;
      const summary = `Webhook updated: ${u.after.name ?? "Unnamed webhook"} (${u.changed.join(", ") || "configuration"})`;
      await recordEvent(db, guildId, {
        type: "WEBHOOK_UPDATED",
        source: opts.source,
        severity: ctx.trust?.protected ? "HIGH" : "INFO",
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        targetType: "WEBHOOK",
        targetId: u.after.id,
        targetName: u.after.name,
        summary,
        details: { changed: u.changed, previousName: u.before.name, previousChannelId: u.before.channelId, channelId: u.after.channelId },
        dedupKey: `webhook-updated:${u.after.id}:${webhookConfigHash(u.after)}`,
        occurredAt: now,
      });
      await db.webhookInventory.update({
        where: { guildId_webhookId: { guildId, webhookId: u.after.id } },
        data: { lastChangeSummary: `Changed ${u.changed.join(", ") || "configuration"}` },
      });
      const alert = webhookUpdatedAlert(u.before, u.after, u.changed, ctx, actor?.name ?? null);
      if (alert) await emitAlert(db, guildId, settings, alert);
    }
  }

  for (const d of diff.deleted) {
    await db.webhookInventory.update({
      where: { guildId_webhookId: { guildId, webhookId: d.webhookId } },
      data: { status: "DELETED", deletedAt: now, lastChangedAt: now, lastChangeSummary: "Deleted" },
    });
    if (opts.baseline) continue;
    const ctx = contextFor(d.channelId, d.webhookId);
    const actor = (await opts.lookupActor?.(AuditLogAction.WebhookDelete, d.webhookId)) ?? null;
    await recordEvent(db, guildId, {
      type: "WEBHOOK_DELETED",
      source: opts.source,
      severity: ctx.trust?.protected ? "HIGH" : "INFO",
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      targetType: "WEBHOOK",
      targetId: d.webhookId,
      targetName: d.name,
      summary: `Webhook deleted: ${d.name ?? "Unnamed webhook"}`,
      details: { channelId: d.channelId },
      dedupKey: `webhook-deleted:${d.webhookId}`,
      occurredAt: now,
    });
    const alert = webhookDeletedAlert(d, ctx, settings, actor?.name ?? null);
    if (alert) await emitAlert(db, guildId, settings, alert);
  }

  // Posture findings for every webhook in scope.
  const drafts: FindingDraft[] = current.flatMap((w) => evaluateWebhook(w, contextFor(w.channelId, w.id)));
  const scopeIds = opts.scopeChannelIds
    ? [...new Set([...current.map((w) => w.id), ...diff.deleted.map((d) => d.webhookId), ...stored.filter((s) => s.channelId && opts.scopeChannelIds!.has(s.channelId)).map((s) => s.webhookId)])]
    : ("ALL" as const);
  const synced = await syncFindings(db, guildId, drafts, [{ targetType: "WEBHOOK", targetIds: scopeIds }], now);

  for (const { finding, transition } of synced.upserted) {
    if (transition !== "created" && transition !== "reopened") continue;
    if (!opts.baseline && createdIds.has(finding.targetId)) continue; // creation alert already covers it
    if (!severityAtLeast(finding.severity, opts.baseline ? "HIGH" : "MEDIUM")) continue;
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
        resourceType: "WEBHOOK",
        resourceId: finding.targetId,
        resourceName: finding.targetName,
        evidence: finding.evidence as Record<string, never>,
      },
      finding.id,
    );
  }

  return { created: diff.created.length, updated: diff.updated.length, deleted: diff.deleted.length, active: current.length };
}
