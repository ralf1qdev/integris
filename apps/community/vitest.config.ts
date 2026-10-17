import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      APP_URL: "https://integris.test",
      DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
      COMMUNITY_BOT_TOKEN: "test-token-not-real-test-token-not-real-test-token-not-real",
      COMMUNITY_CLIENT_ID: "100000000000000001",
      COMMUNITY_GUILD_ID: "100000000000000002",
    },
  },
});
