import "server-only";
import { HEARTBEAT_TTL_SECONDS, heartbeatKey, type Heartbeat, type HeartbeatService } from "@integris/shared/heartbeat";
import { db } from "./db";
import { redis } from "./redis";

export type ComponentState = "operational" | "degraded" | "down";

export interface ComponentStatus {
  key: string;
  name: string;
  description: string;
  state: ComponentState;
  detail: string;
}

export interface SystemStatus {
  overall: ComponentState;
  checkedAt: string;
  components: ComponentStatus[];
}

const withTimeout = <T,>(p: Promise<T>, ms = 3_000) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

async function heartbeat(service: HeartbeatService): Promise<Heartbeat | null> {
  const raw = await withTimeout(redis().get(heartbeatKey(service)));
  return raw ? (JSON.parse(raw) as Heartbeat) : null;
}

/**
 * Live status from real checks: the database and Redis are queried, the worker and
 * bot are judged by heartbeats they write every 20 s (expiring after 90 s).
 * Only coarse states are exposed publicly.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const [database, cache, worker, bot] = await Promise.allSettled([
    withTimeout(db.$queryRaw`SELECT 1`),
    withTimeout(redis().ping()),
    heartbeat("worker"),
    heartbeat("bot"),
  ]);
  const redisUp = cache.status === "fulfilled";

  const heartbeatState = (r: PromiseSettledResult<Heartbeat | null>): [ComponentState, string] => {
    if (!redisUp || r.status === "rejected") return ["degraded", "Status unknown — the queue is unreachable"];
    if (!r.value) return ["down", `No heartbeat in the last ${HEARTBEAT_TTL_SECONDS} seconds`];
    return ["operational", "Running"];
  };

  const [workerState, workerDetail] = heartbeatState(worker);
  let [botState, botDetail] = heartbeatState(bot);
  if (botState === "operational" && bot.status === "fulfilled" && bot.value?.pingMs !== undefined) {
    botDetail = `Connected to Discord · ${bot.value.pingMs} ms gateway latency`;
    if (bot.value.pingMs > 1_000) botState = "degraded";
  }

  const components: ComponentStatus[] = [
    { key: "web", name: "Website & dashboard", description: "integris dashboard and API", state: "operational", detail: "Serving requests" },
    {
      key: "database",
      name: "Database",
      description: "Inventory, findings and alerts",
      state: database.status === "fulfilled" ? "operational" : "down",
      detail: database.status === "fulfilled" ? "Reachable" : "Unreachable",
    },
    { key: "queue", name: "Job queue", description: "Scans and alert delivery queue", state: redisUp ? "operational" : "down", detail: redisUp ? "Reachable" : "Unreachable" },
    { key: "worker", name: "Monitoring worker", description: "Scans, change detection and alert delivery", state: workerState, detail: workerDetail },
    { key: "bot", name: "Discord bot", description: "Live events and slash commands", state: botState, detail: botDetail },
  ];

  const overall: ComponentState = components.some((c) => c.state === "down")
    ? components.filter((c) => c.state === "down").length > 1 || components.find((c) => c.key === "database")?.state === "down"
      ? "down"
      : "degraded"
    : components.some((c) => c.state === "degraded")
      ? "degraded"
      : "operational";

  return { overall, checkedAt: new Date().toISOString(), components };
}
