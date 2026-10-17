import { activitySeries } from "@integris/database";
import { activityRangeSchema } from "@integris/shared";
import { apiError, guildRoute, json } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = guildRoute<{ guildId: string }>({}, async (req, { guild }) => {
  const parsed = activityRangeSchema.safeParse(new URL(req.url).searchParams.get("range") ?? "7d");
  if (!parsed.success) return apiError(400, "invalid_range", "Range must be 24h, 7d or 30d.");
  return json({ range: parsed.data, points: await activitySeries(db, guild.id, parsed.data) });
});
