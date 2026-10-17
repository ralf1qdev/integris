import type { Job } from "bullmq";
import { createScanJob, deleteGuildData, getInstalledGuildIds, purgeExpiredData } from "@integris/database";
import { maintenanceJobSchema, type MaintenanceJobData } from "@integris/shared/queue";
import { discordCode, DiscordError, leaveGuild } from "../discord";
import { log } from "../log";
import { enqueueScan } from "../queues";
import { db } from "../state";

export async function processMaintenance(job: Job<MaintenanceJobData>) {
  const data = maintenanceJobSchema.parse(job.data);
  switch (data.type) {
    case "schedule-scans": {
      const ids = await getInstalledGuildIds(db);
      const enabled = await db.guildSettings.findMany({ where: { guildId: { in: ids }, monitoringEnabled: true }, select: { guildId: true } });
      let queued = 0;
      for (const [i, { guildId }] of enabled.entries()) {
        const r = await createScanJob(db, { guildId, trigger: "SCHEDULED" });
        if (r.status !== "created") continue;
        // Spread scans out so large fleets do not burst the Discord API.
        await enqueueScan({ guildId, scanJobId: r.scan.id, trigger: "SCHEDULED" }, i * 2_000);
        queued++;
      }
      log.info({ queued }, "scheduled scans queued");
      return { queued };
    }
    case "retention": {
      const result = await purgeExpiredData(db);
      log.info(result, "retention applied");
      return result;
    }
    case "delete-guild-data": {
      let left = false;
      if (data.leaveGuild) {
        try {
          await leaveGuild(data.guildId);
          left = true;
        } catch (err) {
          if (discordCode(err) !== DiscordError.UnknownGuild) throw err;
        }
      }
      const result = await deleteGuildData(db, { guildId: data.guildId, requestedById: data.requestedById, leftGuild: left });
      log.info({ guildId: data.guildId, requestedById: data.requestedById, left }, "guild data deleted");
      return { deleted: Boolean(result), left };
    }
  }
}
