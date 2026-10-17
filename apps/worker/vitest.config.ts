import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

function readRootEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const file = resolve(__dirname, "../../.env");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim() || undefined;
}

const testUrl = readRootEnv("DATABASE_URL_TEST");
if (testUrl) {
  execSync("npx prisma migrate deploy", { cwd: resolve(__dirname, "../../packages/database"), env: { ...process.env, DATABASE_URL: testUrl }, stdio: "ignore" });
}

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      DATABASE_URL_TEST: testUrl ?? "",
      DATABASE_URL: testUrl ?? "postgresql://unused@localhost/unused",
      APP_URL: "https://integris.test",
      REDIS_URL: "redis://localhost:6379",
      DISCORD_BOT_TOKEN: "test-token-not-real-test-token-not-real-test-token-not-real",
      LOG_LEVEL: "error",
    },
  },
});
