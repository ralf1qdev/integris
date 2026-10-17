import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getPrisma } from "@integris/database";
import { createLogger } from "@integris/shared/logger";
import { DEFAULT_JOB_OPTIONS, jobId, parseRedisUrl, QUEUES, type GatewaySignal, type ScanJobData } from "@integris/shared/queue";
import { env } from "./env";

export const log = createLogger("bot");
export const db = getPrisma();

const connection = parseRedisUrl(env.REDIS_URL);
export const scanQueue = new Queue<ScanJobData>(QUEUES.scan, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
/** Plain connection for non-queue keys (heartbeats). */
export const redis = new Redis({ ...connection, maxRetriesPerRequest: 2 });
export const eventQueue = new Queue<GatewaySignal>(QUEUES.events, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });

export async function enqueueScan(data: ScanJobData) {
  await scanQueue.add("scan", data, { jobId: jobId("scan", data.scanJobId) });
}

/**
 * Forwards a Gateway signal to the worker. `key` makes redelivered Gateway
 * events idempotent; `debounceMs` collapses bursts (e.g. several webhook edits).
 */
export async function forward(signal: GatewaySignal, key: string, debounceMs = 0) {
  const bucket = debounceMs ? Math.floor(Date.now() / debounceMs) : Date.now();
  try {
    await eventQueue.add(signal.type, signal, { jobId: jobId(signal.type, key, bucket), delay: debounceMs });
  } catch (err) {
    log.error({ err, type: signal.type, guildId: signal.guildId }, "failed to forward signal");
  }
}
