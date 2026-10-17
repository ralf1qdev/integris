import { setFindingStatus } from "@integris/database";
import { findingStatusUpdateSchema } from "@integris/shared";
import { actorName, apiError, guildRoute, json, parseBody } from "@/lib/auth";
import { db } from "@/lib/db";

export const PATCH = guildRoute<{ guildId: string; findingId: string }>({ mutation: true }, async (req, { guild, session, params }) => {
  const body = await parseBody(req, findingStatusUpdateSchema);
  if ("response" in body) return body.response;
  const finding = await setFindingStatus(db, { guildId: guild.id, findingId: params.findingId, status: body.data.status, actorId: session.user.id, actorName: actorName(session) });
  if (!finding) return apiError(404, "not_found", "Finding not found.");
  return json({ finding: { id: finding.id, status: finding.status } });
});
