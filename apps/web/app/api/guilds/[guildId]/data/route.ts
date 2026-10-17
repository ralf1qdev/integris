import { recordEvent } from "@integris/database";
import { guildDataDeletionSchema } from "@integris/shared";
import { actorName, apiError, guildRoute, json, parseBody } from "@/lib/auth";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { enqueueGuildDeletion } from "@/lib/queues";

/** Guild data deletion workflow: confirmation by name, audit trail, then asynchronous erasure. */
export const DELETE = guildRoute<{ guildId: string }>({ mutation: true, limit: { bucket: "data-delete", max: 3, windowSeconds: 3600 } }, async (req, { guild, session, access }) => {
  if (!access.isOwner && !(BigInt(access.permissions) & (1n << 3n))) {
    return apiError(403, "owner_required", "Only the server owner or an Administrator can delete all Integris data for this server.");
  }
  const body = await parseBody(req, guildDataDeletionSchema);
  if ("response" in body) return body.response;
  if (body.data.confirmGuildName !== guild.name) return apiError(422, "confirmation_mismatch", "The server name you typed does not match.");

  await recordEvent(db, guild.id, {
    type: "DATA_DELETION_REQUESTED",
    source: "DASHBOARD",
    severity: "HIGH",
    actorId: session.user.id,
    actorName: actorName(session),
    targetType: "GUILD",
    targetId: guild.id,
    targetName: guild.name,
    summary: `${actorName(session)} requested deletion of all Integris data`,
    details: { leaveGuild: body.data.leaveGuild },
  });
  await enqueueGuildDeletion(guild.id, session.user.id, body.data.leaveGuild);
  log.warn({ guildId: guild.id, actorId: session.user.id, leaveGuild: body.data.leaveGuild }, "guild data deletion requested");
  return json({ queued: true }, 202);
});
