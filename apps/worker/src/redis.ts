import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { DelayedError, type Job } from "bullmq";
import { parseRedisUrl } from "@integris/shared/queue";
import { env } from "./env";

/** BullMQ requires maxRetriesPerRequest: null on worker connections. */
export const connection = { ...parseRedisUrl(env.REDIS_URL), maxRetriesPerRequest: null };
export const redis = new Redis(connection);

const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/**
 * Serialises all work for one guild (scans and event processing) so inventory
 * transitions are computed from a consistent state. If the lock is busy the job
 * is re-delayed instead of blocking a worker slot.
 */
export async function withGuildLock<T>(guildId: string, job: Job, token: string | undefined, fn: () => Promise<T>): Promise<T> {
  const key = `integris:lock:guild:${guildId}`;
  const owner = randomUUID();
  const acquired = await redis.set(key, owner, "PX", 5 * 60_000, "NX");
  if (!acquired) {
    await job.moveToDelayed(Date.now() + 1_000 + Math.floor(Math.random() * 2_000), token);
    throw new DelayedError();
  }
  try {
    return await fn();
  } finally {
    await redis.eval(RELEASE, 1, key, owner);
  }
}
