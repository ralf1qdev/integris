import { createScanJob } from "@integris/database";
import { apiError, guildRoute, json } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueScan } from "@/lib/queues";

export const POST = guildRoute<{ guildId: string }>({ mutation: true, limit: { bucket: "scan", max: 5, windowSeconds: 60 } }, async (_req, { guild, session }) => {
  const r = await createScanJob(db, { guildId: guild.id, trigger: "DASHBOARD", requestedById: session.user.id });
  if (r.status === "cooldown") {
    const seconds = Math.ceil(r.retryAfterMs / 1000);
    return apiError(429, "scan_cooldown", `A scan was requested moments ago. Try again in ${seconds}s.`, { "Retry-After": String(seconds) });
  }
  if (r.status === "created") await enqueueScan({ guildId: guild.id, scanJobId: r.scan.id, trigger: "DASHBOARD", requestedById: session.user.id });
  return json({ scan: { id: r.scan.id, status: r.scan.status }, alreadyPending: r.status === "already_pending" }, r.status === "created" ? 202 : 200);
});
