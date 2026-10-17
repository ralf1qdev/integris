import "server-only";
import { Queue } from "bullmq";
import { DEFAULT_JOB_OPTIONS, jobId, QUEUES, type AlertDeliveryData, type MaintenanceJobData, type ScanJobData } from "@integris/shared/queue";
import { redisConnection } from "./redis";

const g = globalThis as unknown as { __integrisQueues?: { scan: Queue<ScanJobData>; alerts: Queue<AlertDeliveryData>; maintenance: Queue<MaintenanceJobData> } };

function queues() {
  g.__integrisQueues ??= {
    scan: new Queue<ScanJobData>(QUEUES.scan, { connection: redisConnection(), defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    alerts: new Queue<AlertDeliveryData>(QUEUES.alerts, { connection: redisConnection(), defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    maintenance: new Queue<MaintenanceJobData>(QUEUES.maintenance, { connection: redisConnection(), defaultJobOptions: DEFAULT_JOB_OPTIONS }),
  };
  return g.__integrisQueues;
}

export async function enqueueScan(data: ScanJobData) {
  await queues().scan.add("scan", data, { jobId: jobId("scan", data.scanJobId) });
}

/** Edits the delivered Discord alert message after a status change from the dashboard. */
export async function enqueueAlertSync(guildId: string, alertId: string) {
  await queues().alerts.add("sync", { guildId, alertId, mode: "sync" });
}

export async function enqueueGuildDeletion(guildId: string, requestedById: string, leaveGuild: boolean) {
  await queues().maintenance.add("delete-guild-data", { type: "delete-guild-data", guildId, requestedById, leaveGuild }, { jobId: jobId("delete", guildId) });
}
