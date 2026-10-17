/**
 * Liveness heartbeats written to Redis by long-running services and read by the
 * public status page. A missing key (expired TTL) means the service is down.
 */
export const HEARTBEAT_SERVICES = ["worker", "bot"] as const;
export type HeartbeatService = (typeof HEARTBEAT_SERVICES)[number];

export const HEARTBEAT_INTERVAL_MS = 20_000;
export const HEARTBEAT_TTL_SECONDS = 90;

export const heartbeatKey = (service: HeartbeatService) => `integris:heartbeat:${service}`;

export interface Heartbeat {
  at: string;
  /** Gateway latency in ms, bot only. */
  pingMs?: number;
}
