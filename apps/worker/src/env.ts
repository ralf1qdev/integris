import { config } from "dotenv";
import { resolve } from "node:path";
import { loadEnv } from "@integris/shared/env";

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
config({ quiet: true });

export const env = loadEnv([
  "NODE_ENV",
  "LOG_LEVEL",
  "APP_URL",
  "DATABASE_URL",
  "REDIS_URL",
  "DISCORD_BOT_TOKEN",
  "SCAN_INTERVAL_MINUTES",
  "SCAN_CONCURRENCY",
] as const);
