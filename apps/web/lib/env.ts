import "server-only";
import { loadEnv } from "@integris/shared/env";

let cached: ReturnType<typeof read> | undefined;
function read() {
  return loadEnv([
    "NODE_ENV",
    "APP_URL",
    "DATABASE_URL",
    "REDIS_URL",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_BOT_TOKEN",
    "DISCORD_REDIRECT_URI",
    "SESSION_SECRET",
    "ENCRYPTION_KEY",
  ] as const);
}

/** Server-only configuration, validated on first use. Never imported by client components. */
export function env() {
  cached ??= read();
  return cached;
}
