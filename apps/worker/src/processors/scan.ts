import { UnrecoverableError, type Job } from "bullmq";
import { getSettings, markGuildRemoved, recordEvent } from "@integris/database";
import { scanJobSchema, type ScanJobData } from "@integris/shared/queue";
import { AuditLogAction } from "@integris/shared";
import { applyBots, observeMember } from "../bots";
import { discordCode, DiscordError, isAccessError, listBotMembers, listGuildWebhooks } from "../discord";
import { log } from "../log";
import { withGuildLock } from "../redis";
import { channelNameMap, refreshGuildSnapshot } from "../snapshot";
import { db, self } from "../state";
import { applyWebhooks, auditActorLookup } from "../webhooks";

export const MEMBERS_INTENT_HELP =
  "Bot inventory unavailable: Discord refused the member list. Enable the Server Members Intent for the Integris application (Developer Portal → Bot → Privileged Gateway Intents).";
export const WEBHOOK_PERMISSION_HELP =
  "Webhook inventory unavailable: Integris needs the Manage Webhooks permission, which Discord requires before it will list webhooks.";

/**
 * Full reconciliation scan. Catches anything the Gateway did not report:
 * Discord does not emit an event for every change, and events can be missed
 * during disconnects.
 */
export async function processScan(job: Job<ScanJobData>, token?: string) {
  const data = scanJobSchema.parse(job.data);
  const { guildId } = data;

  return withGuildLock(guildId, job, token, async () => {
    const scan = await db.scanJob.findUnique({ where: { id: data.scanJobId } });
    if (!scan || scan.guildId !== guildId || scan.status === "SUCCEEDED") return { skipped: true };
    const guild = await db.guild.findUnique({ where: { id: guildId } });
    if (!guild?.botPresent) {
      await db.scanJob.update({ where: { id: scan.id }, data: { status: "FAILED", error: "Integris is not installed in this server.", finishedAt: new Date() } });
      return { skipped: true };
    }

    const startedAt = new Date();
    await db.scanJob.update({ where: { id: scan.id }, data: { status: "RUNNING", startedAt, attempts: { increment: 1 } } });
    const baseline = guild.lastSyncAt === null;
    const warnings: string[] = [];

    try {
      const ctx = await refreshGuildSnapshot(guildId);
      const settings = await getSettings(db, guildId);

      let botStats = null;
      try {
        const members = await listBotMembers(guildId);
        botStats = await applyBots(db, guildId, members.map(observeMember), {
          ctx,
          settings,
          selfId: self.id,
          source: "RECONCILIATION",
          baseline,
          scope: "ALL",
          resolveAdder: async (botId) => auditActorLookup(guildId, 24 * 3600_000)(AuditLogAction.BotAdd, botId),
          now: startedAt,
        });
      } catch (err) {
        if (!isAccessError(err)) throw err;
        warnings.push(MEMBERS_INTENT_HELP);
      }

      let webhookStats = null;
      try {
        const webhooks = await listGuildWebhooks(guildId);
        webhookStats = await applyWebhooks(db, guildId, webhooks, {
          settings,
          channelNames: channelNameMap(ctx),
          source: "RECONCILIATION",
          baseline,
          lookupActor: auditActorLookup(guildId, 24 * 3600_000),
          now: startedAt,
        });
      } catch (err) {
        if (!isAccessError(err)) throw err;
        warnings.push(WEBHOOK_PERMISSION_HELP);
      }

      const stats = {
        bots: botStats ? { present: await db.botInventory.count({ where: { guildId, isPresent: true } }), ...botStats } : null,
        webhooks: webhookStats,
        roles: ctx.roles.length,
        channels: ctx.channels.length,
        warnings,
        baseline,
        durationMs: Date.now() - startedAt.getTime(),
      };
      const finishedAt = new Date();
      const warningText = warnings.length ? warnings.join(" ") : null;
      await db.scanJob.update({ where: { id: scan.id }, data: { status: "SUCCEEDED", finishedAt, stats, error: warningText } });
      await db.guild.update({ where: { id: guildId }, data: { lastSyncAt: finishedAt, lastSyncStatus: "SUCCEEDED", lastSyncError: warningText } });
      await recordEvent(db, guildId, {
        type: "SCAN_COMPLETED",
        source: "SYSTEM",
        severity: warnings.length ? "LOW" : "INFO",
        actorId: scan.requestedById,
        targetType: "GUILD",
        targetId: guildId,
        summary: baseline
          ? `Initial scan completed: ${stats.bots?.present ?? "unknown number of"} bots, ${webhookStats?.active ?? "unknown number of"} webhooks inventoried`
          : `Scan completed (${scan.trigger.toLowerCase()})`,
        details: stats,
        dedupKey: `scan:${scan.id}`,
        occurredAt: finishedAt,
      });
      log.info({ guildId, scanJobId: scan.id, ...stats }, "scan completed");
      return stats;
    } catch (err) {
      const code = discordCode(err);
      if (code === DiscordError.UnknownGuild || code === DiscordError.MissingAccess) {
        await markGuildRemoved(db, guildId);
        await db.scanJob.update({ where: { id: scan.id }, data: { status: "FAILED", finishedAt: new Date(), error: "Integris no longer has access to this server." } });
        throw new UnrecoverableError("guild no longer accessible");
      }
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      const message = err instanceof Error ? err.message : String(err);
      await db.scanJob.update({
        where: { id: scan.id },
        data: finalAttempt ? { status: "FAILED", finishedAt: new Date(), error: `Scan failed: ${message}` } : { status: "QUEUED", error: `Retrying: ${message}` },
      });
      if (finalAttempt) {
        await db.guild.update({ where: { id: guildId }, data: { lastSyncStatus: "FAILED", lastSyncError: message.slice(0, 500) } });
        await recordEvent(db, guildId, { type: "SCAN_FAILED", source: "SYSTEM", severity: "LOW", targetType: "GUILD", targetId: guildId, summary: "Scan failed", details: { error: message.slice(0, 500) }, dedupKey: `scan-failed:${scan.id}` });
      }
      throw err;
    }
  });
}
