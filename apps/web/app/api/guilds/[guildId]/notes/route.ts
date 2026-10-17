import { addNote } from "@integris/database";
import { noteCreateSchema } from "@integris/shared";
import { actorName, apiError, guildRoute, json, parseBody } from "@/lib/auth";
import { db } from "@/lib/db";

export const POST = guildRoute<{ guildId: string }>({ mutation: true }, async (req, { guild, session }) => {
  const body = await parseBody(req, noteCreateSchema);
  if ("response" in body) return body.response;
  const r = await addNote(db, { guildId: guild.id, ...body.data, authorId: session.user.id, authorName: actorName(session) });
  if ("error" in r) return apiError(404, "not_found", "That integration is not in this server's inventory.");
  return json({ note: r.note }, 201);
});
