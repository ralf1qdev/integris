import { UnrecoverableError, type Job } from "bullmq";
import { Routes } from "discord-api-types/v10";
import { markAlertDelivered, markAlertDeliveryFailed } from "@integris/database";
import { buildAlertMessage } from "@integris/shared/embeds";
import { alertDeliverySchema, type AlertDeliveryData } from "@integris/shared/queue";
import { discordCode, DiscordError, rest } from "../discord";
import { env } from "../env";
import { db } from "../state";

const FAILURE_HELP: Partial<Record<number, string>> = {
  [DiscordError.MissingPermissions]: "Integris lacks Send Messages or Embed Links in the alert channel.",
  [DiscordError.MissingAccess]: "Integris cannot view the alert channel. Grant it View Channel there.",
  [DiscordError.UnknownChannel]: "The configured alert channel no longer exists. Choose a new one in Settings.",
};

export async function processAlert(job: Job<AlertDeliveryData>) {
  const data = alertDeliverySchema.parse(job.data);
  const alert = await db.securityAlert.findFirst({ where: { id: data.alertId, guildId: data.guildId } });
  if (!alert) return { skipped: "alert not found" };
  const settings = await db.guildSettings.findUnique({ where: { guildId: data.guildId } });
  const message = buildAlertMessage(alert, env.APP_URL, data.mode === "deliver" ? settings?.alertMentionRoleId : null);

  try {
    if (data.mode === "sync") {
      if (!alert.deliveryChannelId || !alert.deliveryMessageId) return { skipped: "never delivered" };
      await rest.patch(Routes.channelMessage(alert.deliveryChannelId, alert.deliveryMessageId), {
        body: { embeds: message.embeds, components: message.components },
      });
      return { synced: true };
    }

    if (alert.deliveredAt) return { skipped: "already delivered" };
    const channelId = settings?.alertChannelId;
    if (!channelId) return { skipped: "no alert channel" };
    const sent = (await rest.post(Routes.channelMessages(channelId), { body: message })) as { id: string };
    await markAlertDelivered(db, alert.id, { channelId, messageId: sent.id });
    return { delivered: true };
  } catch (err) {
    const code = discordCode(err);
    const help = code !== null ? FAILURE_HELP[code] : undefined;
    if (help || code === 10008 /* Unknown Message */) {
      if (data.mode === "deliver" && help) await markAlertDeliveryFailed(db, alert.id, help);
      throw new UnrecoverableError(help ?? "message no longer exists");
    }
    throw err;
  }
}
