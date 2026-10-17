import { config } from "dotenv";
import { resolve } from "node:path";
import { loadEnv } from "@integris/shared/env";

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
config({ quiet: true });

export const env = loadEnv(["NODE_ENV", "LOG_LEVEL", "APP_URL", "DATABASE_URL", "COMMUNITY_BOT_TOKEN", "COMMUNITY_CLIENT_ID", "COMMUNITY_GUILD_ID"] as const);
