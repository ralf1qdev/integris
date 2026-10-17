import { z } from "zod";

const encryptionKey = z
  .string()
  .min(1, "required")
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes encoded as base64 (openssl rand -base64 32)");

const snowflake = z.string().regex(/^\d{15,21}$/);

export const envFields = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  APP_URL: z.string().url().transform((v) => v.replace(/\/$/, "")),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  DISCORD_CLIENT_ID: snowflake,
  DISCORD_CLIENT_SECRET: z.string().min(16),
  DISCORD_BOT_TOKEN: z.string().min(50),
  DISCORD_REDIRECT_URI: z.string().url(),
  DISCORD_DEV_GUILD_ID: z.union([snowflake, z.literal("")]).optional(),
  COMMUNITY_BOT_TOKEN: z.string().min(50),
  COMMUNITY_CLIENT_ID: snowflake,
  COMMUNITY_GUILD_ID: snowflake,
  SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),
  ENCRYPTION_KEY: encryptionKey,
  SCAN_INTERVAL_MINUTES: z.coerce.number().int().min(15).max(10_080).default(360),
  SCAN_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
};

type Fields = typeof envFields;
type Key = keyof Fields;

/**
 * Validates only the variables an app needs. Error messages list variable
 * names and problems, never values.
 */
export function loadEnv<K extends Key>(keys: readonly K[], source: NodeJS.ProcessEnv = process.env) {
  const shape = Object.fromEntries(keys.map((k) => [k, envFields[k]])) as { [P in K]: Fields[P] };
  const result = z.object(shape).safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example.`);
  }
  return result.data as { [P in K]: z.infer<Fields[P]> };
}
