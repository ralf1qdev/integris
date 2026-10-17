import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run against a disposable database (DATABASE_URL_TEST).
// Migrations are applied here; each test truncates every table first.
function readRootEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const file = resolve(__dirname, "../../.env");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim() || undefined;
}

const testUrl = readRootEnv("DATABASE_URL_TEST");
if (testUrl) {
  execSync("npx prisma migrate deploy", {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "ignore",
  });
}

export default defineConfig({
  test: {
    env: { DATABASE_URL_TEST: testUrl ?? "" },
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
