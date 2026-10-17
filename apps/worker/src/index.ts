import { Worker, type Job } from "bullmq";
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_TTL_SECONDS, heartbeatKey, type Heartbeat } from "@integris/shared/heartbeat";
import { QUEUES } from "@integris/shared/queue";
import { env } from "./env";
import { getSelf } from "./discord";
import { log } from "./log";
import { processAlert } from "./processors/alerts";
import { processEvent } from "./processors/events";
import { processMaintenance } from "./processors/maintenance";
import { processScan } from "./processors/scan";
import { maintenanceQueue } from "./queues";
import { connection, redis } from "./redis";
import { db, self } from "./state";

async function main() {
  const me = await getSelf();
  self.id = me.id;
  log.info({ botUserId: me.id }, "worker starting");

  const workers = [
    new Worker(QUEUES.scan, processScan, { connection, concurrency: env.SCAN_CONCURRENCY }),
    new Worker(QUEUES.events, processEvent, { connection, concurrency: 8 }),
    new Worker(QUEUES.alerts, processAlert, { connection, concurrency: 4, limiter: { max: 20, duration: 1_000 } }),
    new Worker(QUEUES.maintenance, processMaintenance, { connection, concurrency: 1 }),
  ];

  for (const w of workers) {
    w.on("failed", (job: Job | undefined, err) => {
      log.warn({ queue: w.name, jobId: job?.id, attempts: job?.attemptsMade, err }, "job failed");
    });
    w.on("error", (err) => log.error({ queue: w.name, err }, "worker error"));
  }

  await maintenanceQueue.upsertJobScheduler("schedule-scans", { every: env.SCAN_INTERVAL_MINUTES * 60_000 }, { name: "schedule-scans", data: { type: "schedule-scans" } });
  await maintenanceQueue.upsertJobScheduler("retention", { pattern: "17 3 * * *" }, { name: "retention", data: { type: "retention" } });

  const beat = () =>
    redis
      .setex(heartbeatKey("worker"), HEARTBEAT_TTL_SECONDS, JSON.stringify({ at: new Date().toISOString() } satisfies Heartbeat))
      .catch((err) => log.warn({ err }, "heartbeat failed"));
  void beat();
  const heartbeat = setInterval(beat, HEARTBEAT_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    log.info({ signal }, "worker shutting down");
    clearInterval(heartbeat);
    await redis.del(heartbeatKey("worker")).catch(() => {});
    await Promise.allSettled(workers.map((w) => w.close()));
    await maintenanceQueue.close();
    await db.$disconnect();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  log.fatal({ err }, "worker failed to start");
  process.exit(1);
});
