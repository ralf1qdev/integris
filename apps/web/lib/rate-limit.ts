import "server-only";
import { redis } from "./redis";
import { log } from "./log";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Fixed-window limiter backed by Redis, shared across web instances.
 * Fails closed for mutations: if Redis is unavailable, writes are refused.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, failOpen = false): Promise<RateLimitResult> {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const k = `integris:rl:${key}:${bucket}`;
  try {
    const r = redis();
    const count = await r.incr(k);
    if (count === 1) await r.expire(k, windowSeconds + 1);
    return { allowed: count <= limit, retryAfterSeconds: windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds) };
  } catch (err) {
    log.error({ err }, "rate limiter unavailable");
    return { allowed: failOpen, retryAfterSeconds: 5 };
  }
}
