import { getLatestScans } from "@integris/database";
import { guildRoute, json } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = guildRoute<{ guildId: string }>({}, async (_req, { guild }) => {
  const scans = await getLatestScans(db, guild.id, 5);
  return json({
    scans: scans.map((s) => ({ id: s.id, status: s.status, trigger: s.trigger, createdAt: s.createdAt, finishedAt: s.finishedAt, error: s.error })),
    lastSyncAt: guild.lastSyncAt,
  });
});
