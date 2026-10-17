import { setTrust } from "@integris/database";
import { snowflakeSchema, trustUpdateSchema } from "@integris/shared";
import { actorName, apiError, guildRoute, json, parseBody } from "@/lib/auth";
import { db } from "@/lib/db";

export const PUT = guildRoute<{ guildId: string; webhookId: string }>({ mutation: true }, async (req, { guild, session, params }) => {
  if (!snowflakeSchema.safeParse(params.webhookId).success) return apiError(400, "invalid_id", "Invalid webhook ID.");
  const body = await parseBody(req, trustUpdateSchema);
  if ("response" in body) return body.response;
  const r = await setTrust(db, {
    guildId: guild.id,
    kind: "WEBHOOK",
    targetId: params.webhookId,
    trusted: body.data.trusted,
    protected: body.data.protected,
    note: body.data.note,
    actorId: session.user.id,
    actorName: actorName(session),
  });
  if ("error" in r) return apiError(404, "not_found", "Webhook not found in this server.");
  // Trust changes posture findings (e.g. "unreviewed"); resolve those immediately rather than waiting for the next scan.
  if (r.trust) {
    await db.securityFinding.updateMany({
      where: { guildId: guild.id, targetType: "WEBHOOK", targetId: params.webhookId, status: { not: "RESOLVED" } },
      data: { status: "RESOLVED", resolvedAt: new Date(), autoResolved: true },
    });
  }
  return json({ trusted: Boolean(r.trust), protected: r.trust?.protected ?? false });
});
