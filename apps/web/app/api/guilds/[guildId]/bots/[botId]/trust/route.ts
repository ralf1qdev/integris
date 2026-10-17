import { setTrust } from "@integris/database";
import { snowflakeSchema, trustUpdateSchema } from "@integris/shared";
import { actorName, apiError, guildRoute, json, parseBody } from "@/lib/auth";
import { db } from "@/lib/db";

export const PUT = guildRoute<{ guildId: string; botId: string }>({ mutation: true }, async (req, { guild, session, params }) => {
  if (!snowflakeSchema.safeParse(params.botId).success) return apiError(400, "invalid_id", "Invalid bot ID.");
  const body = await parseBody(req, trustUpdateSchema);
  if ("response" in body) return body.response;
  const r = await setTrust(db, { guildId: guild.id, kind: "BOT", targetId: params.botId, trusted: body.data.trusted, note: body.data.note, actorId: session.user.id, actorName: actorName(session) });
  if ("error" in r) return apiError(404, "not_found", "Bot not found in this server.");
  return json({ trusted: Boolean(r.trust) });
});
