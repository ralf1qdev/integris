import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      APP_URL: "https://integris.test",
      DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
      REDIS_URL: "redis://localhost:6379",
      DISCORD_CLIENT_ID: "100000000000000000",
      DISCORD_BOT_TOKEN: "test-token-not-real-test-token-not-real-test-token-not-real",
    },
  },
});
