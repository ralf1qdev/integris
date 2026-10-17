import { z } from "zod";
import { SCAN_TRIGGERS } from "./enums";
import { snowflakeSchema } from "./schemas";

/**
 * Queue names and job payload contracts. Producers (web, bot) and the worker
 * share these so jobs are validated on both ends.
 */
export const QUEUES = {
  scan: "integris-scan",
  events: "integris-events",
  alerts: "integris-alerts",
  maintenance: "integris-maintenance",
} as const;

export const scanJobSchema = z.object({
  guildId: snowflakeSchema,
  scanJobId: z.string().min(1),
  trigger: z.enum(SCAN_TRIGGERS),
  requestedById: snowflakeSchema.nullish(),
});
export type ScanJobData = z.infer<typeof scanJobSchema>;

const base = { guildId: snowflakeSchema, occurredAt: z.string().datetime() };

/** Normalised Gateway signals forwarded by the bot to the worker. */
export const gatewaySignalSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("member.added"), ...base, userId: snowflakeSchema }),
  z.object({ type: z.literal("member.removed"), ...base, userId: snowflakeSchema }),
  z.object({
    type: z.literal("member.updated"),
    ...base,
    userId: snowflakeSchema,
    oldRoleIds: z.array(snowflakeSchema).nullable(),
    newRoleIds: z.array(snowflakeSchema),
  }),
  z.object({
    type: z.literal("role.updated"),
    ...base,
    roleId: snowflakeSchema,
    name: z.string(),
    /** null when the previous state was not cached; never guessed. */
    oldPermissions: z.string().regex(/^\d+$/).nullable(),
    newPermissions: z.string().regex(/^\d+$/),
  }),
  z.object({ type: z.literal("role.deleted"), ...base, roleId: snowflakeSchema }),
  z.object({ type: z.literal("webhooks.updated"), ...base, channelId: snowflakeSchema }),
  z.object({ type: z.literal("channel.permissions_changed"), ...base, channelId: snowflakeSchema }),
  z.object({ type: z.literal("channel.deleted"), ...base, channelId: snowflakeSchema }),
  z.object({ type: z.literal("integrations.updated"), ...base }),
  z.object({
    type: z.literal("audit.entry"),
    ...base,
    entryId: snowflakeSchema,
    actionType: z.number().int(),
    executorId: snowflakeSchema.nullable(),
    targetId: z.string().nullable(),
    reason: z.string().max(512).nullable(),
  }),
]);
export type GatewaySignal = z.infer<typeof gatewaySignalSchema>;

export const alertDeliverySchema = z.object({
  guildId: snowflakeSchema,
  alertId: z.string().min(1),
});
export type AlertDeliveryData = z.infer<typeof alertDeliverySchema>;

export const maintenanceJobSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("schedule-scans") }),
  z.object({ type: z.literal("retention") }),
  z.object({
    type: z.literal("delete-guild-data"),
    guildId: snowflakeSchema,
    requestedById: snowflakeSchema,
    leaveGuild: z.boolean(),
  }),
]);
export type MaintenanceJobData = z.infer<typeof maintenanceJobSchema>;

/** Retry policy for every Integris job: exponential backoff from 5s. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
};

/** BullMQ forbids ':' in custom job ids, so deterministic ids use '__'. */
export function jobId(...parts: Array<string | number>): string {
  return parts.map((p) => String(p).replace(/[^A-Za-z0-9_.-]/g, "-")).join("__");
}

export function parseRedisUrl(url: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
} {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname && u.pathname !== "/" ? Number(u.pathname.slice(1)) : undefined,
    tls: u.protocol === "rediss:" ? {} : undefined,
  };
}
