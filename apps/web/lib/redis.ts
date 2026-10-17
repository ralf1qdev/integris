import "server-only";
import { Redis } from "ioredis";
import { parseRedisUrl } from "@integris/shared/queue";
import { env } from "./env";

const g = globalThis as unknown as { __integrisRedis?: Redis };

export function redis(): Redis {
  g.__integrisRedis ??= new Redis({ ...parseRedisUrl(env().REDIS_URL), maxRetriesPerRequest: 2, connectTimeout: 5_000 });
  return g.__integrisRedis;
}

export function redisConnection() {
  return { ...parseRedisUrl(env().REDIS_URL), maxRetriesPerRequest: null };
}
