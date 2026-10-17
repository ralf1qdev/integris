import { updateSettings } from "@integris/database";
import { guildSettingsUpdateSchema } from "@integris/shared";
import { actorName, apiError, guildRoute, json, parseBody } from "@/lib/auth";
import { db } from "@/lib/db";

export const PATCH = guildRoute<{ guildId: string }>({ mutation: true }, async (req, { guild, session }) => {
  const body = await parseBody(req, guildSettingsUpdateSchema);
  if ("response" in body) return body.response;
  const result = await updateSettings(db, guild.id, body.data, { id: session.user.id, name: actorName(session), source: "DASHBOARD" });
  if ("error" in result) {
    return result.error === "UNKNOWN_ROLE"
      ? apiError(422, "unknown_role", "That role cannot be mentioned. Choose a regular role from this server.")
      : apiError(422, "unknown_channel", "One of the selected channels is not part of this server. Run a scan to refresh the channel list.");
  }
  return json({ settings: result });
});
