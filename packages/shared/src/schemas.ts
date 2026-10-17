import { z } from "zod";
import { ALERT_STATUSES, FINDING_STATUSES, INTEGRATION_KINDS, SEVERITIES } from "./enums";

/** Discord snowflakes are 64-bit integers serialised as decimal strings. */
export const snowflakeSchema = z.string().regex(/^\d{15,21}$/, "Must be a Discord ID");

export const severitySchema = z.enum(SEVERITIES);

export const guildSettingsUpdateSchema = z
  .object({
    monitoringEnabled: z.boolean(),
    alertChannelId: snowflakeSchema.nullable(),
    alertMentionRoleId: snowflakeSchema.nullable(),
    alertMinSeverity: severitySchema,
    alertCooldownMinutes: z.number().int().min(5).max(1440),
    alertOnBotJoin: z.boolean(),
    alertOnWebhookCreate: z.boolean(),
    alertOnWebhookDelete: z.boolean(),
    alertOnPermissionEscalation: z.boolean(),
    restrictedChannelIds: z.array(snowflakeSchema).max(100),
    retentionDays: z.number().int().min(7).max(365),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "No settings provided");
export type GuildSettingsUpdate = z.infer<typeof guildSettingsUpdateSchema>;

export const alertStatusUpdateSchema = z.object({ status: z.enum(ALERT_STATUSES) }).strict();
export const findingStatusUpdateSchema = z.object({ status: z.enum(FINDING_STATUSES) }).strict();

export const trustUpdateSchema = z
  .object({
    trusted: z.boolean(),
    /** Webhooks only: alert when a trusted webhook's configuration changes or it is deleted. */
    protected: z.boolean().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const noteCreateSchema = z
  .object({
    kind: z.enum(INTEGRATION_KINDS),
    targetId: snowflakeSchema,
    body: z.string().trim().min(1).max(1000),
  })
  .strict();

export const webhookDeleteSchema = z
  .object({
    /** The user must retype the webhook name, so a delete is never one stray click. */
    confirmName: z.string().min(1).max(100),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();

export const guildDataDeletionSchema = z
  .object({
    confirmGuildName: z.string().min(1).max(100),
    leaveGuild: z.boolean().default(true),
  })
  .strict();

export const ACTIVITY_RANGES = ["24h", "7d", "30d"] as const;
export type ActivityRange = (typeof ACTIVITY_RANGES)[number];
export const activityRangeSchema = z.enum(ACTIVITY_RANGES);

export const listQuerySchema = z.object({
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
