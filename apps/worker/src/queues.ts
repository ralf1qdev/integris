import { Queue } from "bullmq";
import { DEFAULT_JOB_OPTIONS, jobId, QUEUES, type AlertDeliveryData, type MaintenanceJobData, type ScanJobData } from "@integris/shared/queue";
import { connection } from "./redis";

export const scanQueue = new Queue<ScanJobData>(QUEUES.scan, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
export const alertQueue = new Queue<AlertDeliveryData>(QUEUES.alerts, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
export const maintenanceQueue = new Queue<MaintenanceJobData>(QUEUES.maintenance, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });

export async function enqueueScan(data: ScanJobData, delayMs = 0) {
  await scanQueue.add("scan", data, { jobId: jobId("scan", data.scanJobId), delay: delayMs });
}

export async function enqueueAlertDelivery(guildId: string, alertId: string, mode: "deliver" | "sync" = "deliver") {
  await alertQueue.add(mode, { guildId, alertId, mode }, { jobId: mode === "deliver" ? jobId("deliver", alertId) : undefined });
}
