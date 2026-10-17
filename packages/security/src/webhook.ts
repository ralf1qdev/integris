import type { SafeWebhook, Severity } from "@integris/shared";
import { sha256, stableStringify } from "./fingerprint";
import type { AlertDraft, FindingDraft } from "./types";

export interface WebhookTrust {
  protected: boolean;
}

export interface WebhookContext {
  channelName: string | null;
  trust: WebhookTrust | null;
  restrictedChannelIds: ReadonlySet<string>;
}

/** Fields whose change counts as a configuration change. */
export function webhookConfig(w: Pick<SafeWebhook, "name" | "channelId" | "avatar">) {
  return { name: w.name ?? null, channelId: w.channelId ?? null, avatar: w.avatar ?? null };
}

export function webhookConfigHash(w: Pick<SafeWebhook, "name" | "channelId" | "avatar">): string {
  return sha256(stableStringify(webhookConfig(w))).slice(0, 40);
}

const display = (w: SafeWebhook) => w.name ?? "Unnamed webhook";
const channel = (ctx: WebhookContext) => (ctx.channelName ? `#${ctx.channelName}` : "Unknown channel");

/** Posture findings for a webhook that currently exists. */
export function evaluateWebhook(w: SafeWebhook, ctx: WebhookContext): FindingDraft[] {
  const target = { targetType: "WEBHOOK" as const, targetId: w.id, targetName: display(w) };
  const findings: FindingDraft[] = [];
  const restricted = w.channelId !== null && ctx.restrictedChannelIds.has(w.channelId);

  if (restricted && !ctx.trust) {
    findings.push({
      ...target,
      ruleId: "webhook.restricted-channel",
      severity: "HIGH",
      title: "Untrusted webhook in a restricted channel",
      description: `${display(w)} can post in ${channel(ctx)}, which you marked as restricted. Webhook messages can use any name and avatar.`,
      recommendation: "Delete the webhook if it is not expected, or approve it as trusted if it belongs to a known service.",
      evidence: { channel: channel(ctx), creator: w.creatorName ?? "Unknown" },
    });
  }

  if (!ctx.trust && w.creatorIsBot === true && w.type === 1) {
    findings.push({
      ...target,
      ruleId: "webhook.created-by-bot",
      severity: "LOW",
      title: "Webhook created by a bot account",
      description: `${display(w)} in ${channel(ctx)} was created by the bot ${w.creatorName ?? "Unknown"}. Anyone holding its URL can post as it.`,
      recommendation: "Confirm the creating bot is expected to manage webhooks here, then approve the webhook.",
      evidence: { creator: w.creatorName ?? "Unknown", channel: channel(ctx) },
    });
  }

  if (!ctx.trust) {
    findings.push({
      ...target,
      ruleId: "webhook.unreviewed",
      severity: "INFO",
      title: "Webhook not yet reviewed",
      description: `${display(w)} in ${channel(ctx)} has not been approved by an administrator.`,
      recommendation: "Approve known webhooks so Integris can alert you when they change.",
      evidence: { channel: channel(ctx), creator: w.creatorName ?? "Unknown" },
    });
  }

  return findings;
}

export interface StoredWebhook {
  webhookId: string;
  name: string | null;
  channelId: string | null;
  avatar: string | null;
  configHash: string;
}

export interface WebhookDiff {
  created: SafeWebhook[];
  updated: { before: StoredWebhook; after: SafeWebhook; changed: Array<"name" | "channel" | "avatar"> }[];
  deleted: StoredWebhook[];
}

/**
 * Diffs the stored inventory against what Discord currently reports.
 * `scopeChannelIds` limits deletion detection to channels that were re-fetched.
 */
export function diffWebhooks(previous: StoredWebhook[], current: SafeWebhook[], scopeChannelIds?: ReadonlySet<string>): WebhookDiff {
  const prev = new Map(previous.map((p) => [p.webhookId, p]));
  const curr = new Map(current.map((c) => [c.id, c]));
  const diff: WebhookDiff = { created: [], updated: [], deleted: [] };

  for (const w of current) {
    const before = prev.get(w.id);
    if (!before) {
      diff.created.push(w);
      continue;
    }
    if (before.configHash !== webhookConfigHash(w)) {
      const changed: Array<"name" | "channel" | "avatar"> = [];
      if ((before.name ?? null) !== (w.name ?? null)) changed.push("name");
      if ((before.channelId ?? null) !== (w.channelId ?? null)) changed.push("channel");
      if ((before.avatar ?? null) !== (w.avatar ?? null)) changed.push("avatar");
      diff.updated.push({ before, after: w, changed });
    }
  }
  for (const p of previous) {
    if (curr.has(p.webhookId)) continue;
    if (scopeChannelIds && (p.channelId === null || !scopeChannelIds.has(p.channelId))) continue;
    diff.deleted.push(p);
  }
  return diff;
}

export interface WebhookAlertSettings {
  alertOnWebhookCreate: boolean;
  alertOnWebhookDelete: boolean;
}

export function webhookCreatedAlert(w: SafeWebhook, ctx: WebhookContext, settings: WebhookAlertSettings, actorName: string | null): AlertDraft | null {
  if (!settings.alertOnWebhookCreate || ctx.trust) return null;
  const restricted = w.channelId !== null && ctx.restrictedChannelIds.has(w.channelId);
  const severity: Severity = restricted ? "HIGH" : "MEDIUM";
  return {
    dedupKey: `webhook-created:${w.id}`,
    severity,
    title: restricted ? "Webhook created in a restricted channel" : "Unexpected webhook created",
    description: `A new webhook, ${display(w)}, was created in ${channel(ctx)}.`,
    recommendation: "If you did not expect this webhook, delete it from the Integris dashboard or Discord. Otherwise approve it as trusted.",
    resourceType: "WEBHOOK",
    resourceId: w.id,
    resourceName: display(w),
    evidence: {
      channel: channel(ctx),
      createdBy: actorName ?? w.creatorName ?? "Unknown",
      type: w.type === 1 ? "Incoming" : w.type === 2 ? "Channel follower" : w.type === 3 ? "Application" : "Unknown",
    },
  };
}

export function webhookUpdatedAlert(
  before: StoredWebhook,
  after: SafeWebhook,
  changed: string[],
  ctx: WebhookContext,
  actorName: string | null,
): AlertDraft | null {
  if (!ctx.trust?.protected) return null;
  return {
    dedupKey: `webhook-updated:${after.id}:${webhookConfigHash(after)}`,
    severity: "HIGH",
    title: "Protected webhook modified",
    description: `The protected webhook ${display(after)} changed (${changed.join(", ") || "configuration"}).`,
    recommendation: "Confirm the change was intentional. If not, review the audit log and consider deleting and re-creating the webhook to rotate its URL.",
    resourceType: "WEBHOOK",
    resourceId: after.id,
    resourceName: display(after),
    evidence: {
      changed,
      previousName: before.name ?? "Unknown",
      newName: after.name ?? "Unknown",
      channel: channel(ctx),
      changedBy: actorName ?? "Unknown",
    },
  };
}

export function webhookDeletedAlert(
  w: StoredWebhook,
  ctx: WebhookContext,
  settings: WebhookAlertSettings,
  actorName: string | null,
): AlertDraft | null {
  if (!settings.alertOnWebhookDelete && !ctx.trust?.protected) return null;
  const severity: Severity = ctx.trust?.protected ? "HIGH" : ctx.trust ? "MEDIUM" : "LOW";
  return {
    dedupKey: `webhook-deleted:${w.webhookId}`,
    severity,
    title: ctx.trust?.protected ? "Protected webhook deleted" : "Webhook deleted",
    description: `The webhook ${w.name ?? "Unnamed webhook"} in ${channel(ctx)} was deleted.`,
    recommendation: ctx.trust
      ? "This webhook was trusted. Integrations relying on it will stop working; confirm the deletion was intended."
      : "No action is needed if the deletion was expected.",
    resourceType: "WEBHOOK",
    resourceId: w.webhookId,
    resourceName: w.name ?? "Unnamed webhook",
    evidence: { channel: channel(ctx), deletedBy: actorName ?? "Unknown", wasTrusted: Boolean(ctx.trust) },
  };
}
