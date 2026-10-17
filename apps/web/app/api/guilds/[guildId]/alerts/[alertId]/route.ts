import { setAlertStatus } from "@integris/database";
import { alertStatusUpdateSchema } from "@integris/shared";
import { actorName, apiError, guildRoute, json, parseBody } from "@/lib/auth";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { enqueueAlertSync } from "@/lib/queues";

export const PATCH = guildRoute<{ guildId: string; alertId: string }>({ mutation: true }, async (req, { guild, session, params }) => {
  const body = await parseBody(req, alertStatusUpdateSchema);
  if ("response" in body) return body.response;
  const alert = await setAlertStatus(db, {
    guildId: guild.id,
    alertId: params.alertId,
    status: body.data.status,
    actorId: session.user.id,
    actorName: actorName(session),
    source: "DASHBOARD",
  });
  if (!alert) return apiError(404, "not_found", "Alert not found.");
  if (alert.deliveryMessageId) await enqueueAlertSync(guild.id, alert.id).catch((err) => log.warn({ err }, "alert sync enqueue failed"));
  return json({ alert: { id: alert.id, status: alert.status } });
});
