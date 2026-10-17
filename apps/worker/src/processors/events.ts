import type { Job } from "bullmq";
import {
  attributeActor,
  createScanJob,
  getSettings,
  recordEvent,
  type AuditEventType,
} from "@integris/database";
import { analyseEscalation, label } from "@integris/security";
import { AuditLogAction } from "@integris/shared";
import { gatewaySignalSchema, type GatewaySignal } from "@integris/shared/queue";
import { applyBots, observeMember, type BotObservation } from "../bots";
import { discordCode, DiscordError, getMember, isAccessError, listGuildWebhooks } from "../discord";
import { log } from "../log";
import { enqueueScan } from "../queues";
import { withGuildLock } from "../redis";
import { channelNameMap, refreshGuildSnapshot } from "../snapshot";
import { db, self } from "../state";
import { applyWebhooks, auditActorLookup } from "../webhooks";

/** Signals that only warrant a (debounced) full reconciliation. */
async function scheduleReconcile(guildId: string, reason: string) {
  const r = await createScanJob(db, { guildId, trigger: "EVENT" });
  if (r.status === "created") {
    await enqueueScan({ guildId, scanJobId: r.scan.id, trigger: "EVENT" }, 15_000);
    log.info({ guildId, reason }, "reconciliation scheduled");
  }
}

function storedObservation(b: { botUserId: string; username: string; globalName: string | null; avatar: string | null; roleIds: string[]; verified: boolean | null; joinedAt: Date | null }): BotObservation {
  return { userId: b.botUserId, username: b.username, globalName: b.globalName, avatar: b.avatar, roleIds: b.roleIds, verified: b.verified, joinedAt: b.joinedAt };
}

/** Re-evaluates already-known bots against a fresh role/channel snapshot. */
async function reevaluateBots(guildId: string, botIds: string[] | "ALL_PRESENT", cause: string, occurredAt: Date) {
  const bots = await db.botInventory.findMany({
    where: { guildId, isPresent: true, ...(botIds === "ALL_PRESENT" ? {} : { botUserId: { in: botIds } }) },
  });
  if (!bots.length) return;
  const ctx = await refreshGuildSnapshot(guildId);
  const settings = await getSettings(db, guildId);
  await applyBots(db, guildId, bots.map(storedObservation), {
    ctx,
    settings,
    selfId: self.id,
    source: "GATEWAY",
    baseline: false,
    scope: bots.map((b) => b.botUserId),
    missingMeansRemoved: false,
    cause,
    now: occurredAt,
  });
}

const AUDIT_ATTRIBUTION: Partial<Record<number, AuditEventType[]>> = {
  [AuditLogAction.BotAdd]: ["BOT_ADDED"],
  [AuditLogAction.WebhookCreate]: ["WEBHOOK_CREATED"],
  [AuditLogAction.WebhookUpdate]: ["WEBHOOK_UPDATED"],
  [AuditLogAction.WebhookDelete]: ["WEBHOOK_DELETED"],
  [AuditLogAction.RoleUpdate]: ["ROLE_PERMISSIONS_CHANGED"],
  [AuditLogAction.MemberRoleUpdate]: ["BOT_PERMISSIONS_CHANGED", "PERMISSION_ESCALATION"],
};

const INTEGRATION_EVENTS: Partial<Record<number, { type: AuditEventType; verb: string }>> = {
  [AuditLogAction.IntegrationCreate]: { type: "INTEGRATION_CREATED", verb: "added" },
  [AuditLogAction.IntegrationUpdate]: { type: "INTEGRATION_UPDATED", verb: "updated" },
  [AuditLogAction.IntegrationDelete]: { type: "INTEGRATION_DELETED", verb: "removed" },
};

async function handle(signal: GatewaySignal) {
  const { guildId } = signal;
  const occurredAt = new Date(signal.occurredAt);

  switch (signal.type) {
    case "member.added": {
      let member;
      try {
        member = await getMember(guildId, signal.userId);
      } catch (err) {
        if (discordCode(err) === DiscordError.UnknownMember) return; // already left again
        throw err;
      }
      if (!member.user?.bot) return;
      const ctx = await refreshGuildSnapshot(guildId);
      const settings = await getSettings(db, guildId);
      await applyBots(db, guildId, [observeMember(member)], {
        ctx,
        settings,
        selfId: self.id,
        source: "GATEWAY",
        baseline: false,
        scope: [signal.userId],
        resolveAdder: (botId) => auditActorLookup(guildId)(AuditLogAction.BotAdd, botId),
        now: occurredAt,
      });
      return;
    }

    case "member.removed": {
      const ctx = await refreshGuildSnapshot(guildId);
      const settings = await getSettings(db, guildId);
      await applyBots(db, guildId, [], { ctx, settings, selfId: self.id, source: "GATEWAY", baseline: false, scope: [signal.userId], missingMeansRemoved: true, now: occurredAt });
      return;
    }

    case "member.updated": {
      const bot = await db.botInventory.findUnique({ where: { guildId_botUserId: { guildId, botUserId: signal.userId } } });
      if (!bot?.isPresent) return scheduleReconcile(guildId, "unknown bot updated");
      const ctx = await refreshGuildSnapshot(guildId);
      const settings = await getSettings(db, guildId);
      const added = signal.newRoleIds.filter((r) => !(signal.oldRoleIds ?? bot.roleIds).includes(r));
      const names = added.map((id) => ctx.roles.find((r) => r.id === id)?.name ?? id);
      await applyBots(db, guildId, [{ ...storedObservation(bot), roleIds: signal.newRoleIds }], {
        ctx,
        settings,
        selfId: self.id,
        source: "GATEWAY",
        baseline: false,
        scope: [signal.userId],
        missingMeansRemoved: false,
        cause: names.length ? `Role(s) assigned: ${names.join(", ")}.` : "Its roles changed.",
        now: occurredAt,
      });
      return;
    }

    case "role.updated": {
      const stored = await db.guildRole.findFirst({ where: { id: signal.roleId, guildId } });
      const before = signal.oldPermissions ?? stored?.permissions ?? null;
      if (before === null) return reevaluateBots(guildId, "ALL_PRESENT", `Role ${signal.name} changed.`, occurredAt);
      if (before === signal.newPermissions) {
        if (stored) await db.guildRole.update({ where: { id: stored.id }, data: { name: signal.name } });
        return;
      }
      const esc = analyseEscalation(before, signal.newPermissions);
      const holders = await db.botInventory.findMany({ where: { guildId, isPresent: true, roleIds: { has: signal.roleId } }, select: { botUserId: true } });
      const everyone = signal.roleId === guildId;
      await recordEvent(db, guildId, {
        type: "ROLE_PERMISSIONS_CHANGED",
        source: "GATEWAY",
        severity: esc.dangerousGained.length ? "MEDIUM" : "INFO",
        targetType: "ROLE",
        targetId: signal.roleId,
        targetName: signal.name,
        summary: `Role permissions changed: ${signal.name}`,
        details: { gained: esc.gained.map(label), lost: esc.lost.map(label), botHolders: holders.length },
        occurredAt,
      });
      await reevaluateBots(guildId, everyone ? "ALL_PRESENT" : holders.map((h) => h.botUserId), `Role ${signal.name} gained or lost permissions.`, occurredAt);
      return;
    }

    case "role.deleted":
      return reevaluateBots(guildId, "ALL_PRESENT", "A role was deleted.", occurredAt);

    case "channel.permissions_changed":
      return reevaluateBots(guildId, "ALL_PRESENT", "Channel permission overwrites changed.", occurredAt);

    case "webhooks.updated":
    case "channel.deleted": {
      // Discord only says "something changed in this channel"; a full listing is
      // one call and correctly handles webhooks that moved between channels.
      const ctx = await refreshGuildSnapshot(guildId);
      const settings = await getSettings(db, guildId);
      let webhooks;
      try {
        webhooks = await listGuildWebhooks(guildId);
      } catch (err) {
        if (isAccessError(err)) return;
        throw err;
      }
      await applyWebhooks(db, guildId, webhooks, {
        settings,
        channelNames: channelNameMap(ctx),
        source: "GATEWAY",
        baseline: false,
        lookupActor: auditActorLookup(guildId),
        now: occurredAt,
      });
      if (signal.type === "channel.deleted") await reevaluateBots(guildId, "ALL_PRESENT", "A channel was deleted.", occurredAt);
      return;
    }

    case "integrations.updated":
      return scheduleReconcile(guildId, "integrations updated");

    case "audit.entry": {
      const actor = signal.executorId ? { id: signal.executorId, name: signal.executorName } : null;
      const integration = INTEGRATION_EVENTS[signal.actionType];
      if (integration) {
        await recordEvent(db, guildId, {
          type: integration.type,
          source: "AUDIT_LOG",
          actorId: actor?.id ?? null,
          actorName: actor?.name ?? null,
          targetType: "INTEGRATION",
          targetId: signal.targetId,
          summary: `Integration ${integration.verb}`,
          details: { reason: signal.reason },
          dedupKey: `audit:${signal.entryId}`,
          occurredAt,
        });
        return;
      }
      const types = AUDIT_ATTRIBUTION[signal.actionType];
      if (types && actor && signal.targetId) {
        await attributeActor(db, guildId, { types, targetId: signal.targetId, since: new Date(occurredAt.getTime() - 5 * 60_000) }, actor);
        if (signal.actionType === AuditLogAction.BotAdd) {
          await db.botInventory.updateMany({ where: { guildId, botUserId: signal.targetId, addedById: null }, data: { addedById: actor.id, addedByName: actor.name } });
        }
      }
      return;
    }
  }
}

export async function processEvent(job: Job<GatewaySignal>, token?: string) {
  const signal = gatewaySignalSchema.parse(job.data);
  const guild = await db.guild.findUnique({ where: { id: signal.guildId }, select: { botPresent: true, lastSyncAt: true } });
  if (!guild?.botPresent) return { skipped: "not installed" };
  // Before the initial scan there is no baseline to diff against; that scan will capture the state.
  if (!guild.lastSyncAt && signal.type !== "audit.entry") return { skipped: "awaiting baseline" };
  return withGuildLock(signal.guildId, job, token, async () => {
    await handle(signal);
    return { ok: true };
  });
}
