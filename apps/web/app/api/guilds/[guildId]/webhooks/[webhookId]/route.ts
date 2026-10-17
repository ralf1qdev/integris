import { recordEvent } from "@integris/database";
import { snowflakeSchema, webhookDeleteSchema } from "@integris/shared";
import { actorName, apiError, guildRoute, json, parseBody } from "@/lib/auth";
import { db } from "@/lib/db";
import { DiscordBotError, deleteWebhook, getWebhookGuildId } from "@/lib/discord-bot";
import { log } from "@/lib/log";

const UNKNOWN_WEBHOOK = 10015;

/**
 * Emergency action: deletes a webhook in Discord. Requires the user to retype the
 * webhook name, re-verifies with Discord that the webhook belongs to this guild,
 * and records an audit event naming the administrator.
 */
export const DELETE = guildRoute<{ guildId: string; webhookId: string }>(
  { mutation: true, limit: { bucket: "webhook-delete", max: 10, windowSeconds: 60 } },
  async (req, { guild, session, params }) => {
    if (!snowflakeSchema.safeParse(params.webhookId).success) return apiError(400, "invalid_id", "Invalid webhook ID.");
    const body = await parseBody(req, webhookDeleteSchema);
    if ("response" in body) return body.response;

    const webhook = await db.webhookInventory.findUnique({ where: { guildId_webhookId: { guildId: guild.id, webhookId: params.webhookId } } });
    if (!webhook || webhook.status !== "ACTIVE") return apiError(404, "not_found", "Webhook not found in this server.");
    const expectedName = webhook.name ?? "Unnamed webhook";
    if (body.data.confirmName !== expectedName) return apiError(422, "confirmation_mismatch", "The name you typed does not match the webhook name.");

    const name = actorName(session);
    let alreadyGone = false;
    try {
      const owner = await getWebhookGuildId(webhook.webhookId);
      if (owner !== guild.id) return apiError(409, "guild_mismatch", "Discord reports this webhook belongs to another server. Nothing was deleted.");
      await deleteWebhook(webhook.webhookId, `Integris emergency action by ${name} (${session.user.id})${body.data.reason ? `: ${body.data.reason}` : ""}`);
    } catch (err) {
      if (err instanceof DiscordBotError && err.code === UNKNOWN_WEBHOOK) {
        alreadyGone = true;
      } else if (err instanceof DiscordBotError && (err.status === 403 || err.code === 50013)) {
        return apiError(403, "missing_permission", "Integris needs the Manage Webhooks permission in this channel to delete the webhook.");
      } else {
        throw err;
      }
    }

    const now = new Date();
    await db.webhookInventory.update({ where: { id: webhook.id }, data: { status: "DELETED", deletedAt: now, lastChangedAt: now, lastChangeSummary: `Deleted by ${name} via Integris` } });
    await db.securityFinding.updateMany({
      where: { guildId: guild.id, targetType: "WEBHOOK", targetId: webhook.webhookId, status: { not: "RESOLVED" } },
      data: { status: "RESOLVED", resolvedAt: now, autoResolved: true },
    });
    await recordEvent(db, guild.id, {
      type: "WEBHOOK_DELETED_BY_INTEGRIS",
      source: "DASHBOARD",
      severity: "MEDIUM",
      actorId: session.user.id,
      actorName: name,
      targetType: "WEBHOOK",
      targetId: webhook.webhookId,
      targetName: webhook.name,
      summary: `Webhook ${expectedName} deleted by ${name} using an emergency action`,
      details: { channelId: webhook.channelId, channelName: webhook.channelName, reason: body.data.reason ?? null, alreadyDeletedInDiscord: alreadyGone },
      // Also suppresses the duplicate "webhook deleted" event the Gateway will report.
      dedupKey: `webhook-deleted:${webhook.webhookId}`,
    });
    log.warn({ guildId: guild.id, webhookId: webhook.webhookId, actorId: session.user.id }, "webhook deleted via emergency action");
    return json({ deleted: true, alreadyGone });
  },
);
