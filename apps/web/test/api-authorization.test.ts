import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fakes for the Next.js request context and external services ──
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })) }));
vi.mock("@/lib/queues", () => ({ enqueueScan: vi.fn(), enqueueAlertSync: vi.fn(), enqueueGuildDeletion: vi.fn() }));
const discordGuilds = vi.fn();
vi.mock("@/lib/discord-oauth", () => ({
  DiscordAuthError: class extends Error {},
  fetchUserGuilds: (...args: unknown[]) => discordGuilds(...args),
}));
const deleteWebhook = vi.fn();
const getWebhookGuildId = vi.fn();
vi.mock("@/lib/discord-bot", () => ({
  DiscordBotError: class extends Error {},
  deleteWebhook: (...a: unknown[]) => deleteWebhook(...a),
  getWebhookGuildId: (...a: unknown[]) => getWebhookGuildId(...a),
}));

const { getPrisma } = await import("@integris/database");
const { generateToken, hashToken } = await import("@integris/database/crypto");
const { csrfTokenFor } = await import("@/lib/session");
const alertRoute = await import("@/app/api/guilds/[guildId]/alerts/[alertId]/route");
const settingsRoute = await import("@/app/api/guilds/[guildId]/settings/route");
const webhookRoute = await import("@/app/api/guilds/[guildId]/webhooks/[webhookId]/route");
const trustRoute = await import("@/app/api/guilds/[guildId]/bots/[botId]/trust/route");

const db = getPrisma();
const hasDb = Boolean(process.env.DATABASE_URL_TEST);
const ORIGIN = "https://integris.test";
const GUILD_A = "111111111111111111";
const GUILD_B = "222222222222222222";
const USER = "333333333333333333";
const MANAGE_GUILD = (1n << 5n).toString();
const SEND_MESSAGES = (1n << 11n).toString();
let token = "";

function request(method: string, body?: unknown, opts: { csrf?: string | null; origin?: string | null } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (opts.origin !== null) headers.set("origin", opts.origin ?? ORIGIN);
  if (opts.csrf !== null) headers.set("x-integris-csrf", opts.csrf ?? csrfTokenFor(token));
  return new Request(`${ORIGIN}/api/test`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const ctx = <P>(p: P) => ({ params: Promise.resolve(p) });
const userGuilds = (perms: Record<string, string>) => Object.entries(perms).map(([id, permissions]) => ({ id, name: id, icon: null, owner: false, permissions }));

async function seedAlert(guildId: string) {
  return db.securityAlert.create({
    data: { guildId, dedupKey: `k-${guildId}`, severity: "HIGH", title: "t", description: "d", recommendation: "r", resourceType: "BOT", evidence: {} },
  });
}

describe.skipIf(!hasDb)("guild API authorization", () => {
  beforeEach(async () => {
    const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
    for (const id of [GUILD_A, GUILD_B]) {
      await db.guild.create({ data: { id, name: `Guild ${id.slice(0, 2)}`, botPresent: true, lastSyncAt: new Date() } });
      await db.guildSettings.create({ data: { guildId: id } });
    }
    await db.user.create({ data: { id: USER, username: "admin" } });
    token = generateToken();
    await db.session.create({ data: { tokenHash: hashToken(token), userId: USER, expiresAt: new Date(Date.now() + 3600_000) } });
    jar.clear();
    jar.set("__Host-integris_session", token);
    discordGuilds.mockReset();
    discordGuilds.mockResolvedValue(userGuilds({ [GUILD_A]: MANAGE_GUILD, [GUILD_B]: SEND_MESSAGES }));
  });
  afterAll(() => db.$disconnect());

  it("rejects unauthenticated requests", async () => {
    jar.clear();
    const alert = await seedAlert(GUILD_A);
    const res = await alertRoute.PATCH(request("PATCH", { status: "RESOLVED" }), ctx({ guildId: GUILD_A, alertId: alert.id }));
    expect(res.status).toBe(401);
  });

  it("rejects mutations without a valid CSRF token or from another origin", async () => {
    const alert = await seedAlert(GUILD_A);
    const p = ctx({ guildId: GUILD_A, alertId: alert.id });
    expect((await alertRoute.PATCH(request("PATCH", { status: "RESOLVED" }, { csrf: null }), p)).status).toBe(403);
    expect((await alertRoute.PATCH(request("PATCH", { status: "RESOLVED" }, { csrf: "forged" }), p)).status).toBe(403);
    expect((await alertRoute.PATCH(request("PATCH", { status: "RESOLVED" }, { origin: "https://evil.example" }), p)).status).toBe(403);
    expect((await db.securityAlert.findUniqueOrThrow({ where: { id: alert.id } })).status).toBe("OPEN");
  });

  it("updates an alert in a guild the user manages", async () => {
    const alert = await seedAlert(GUILD_A);
    const res = await alertRoute.PATCH(request("PATCH", { status: "ACKNOWLEDGED" }), ctx({ guildId: GUILD_A, alertId: alert.id }));
    expect(res.status).toBe(200);
    expect((await db.securityAlert.findUniqueOrThrow({ where: { id: alert.id } })).acknowledgedById).toBe(USER);
  });

  it("denies a guild where Discord reports no Manage Server permission", async () => {
    const alert = await seedAlert(GUILD_B);
    const res = await alertRoute.PATCH(request("PATCH", { status: "RESOLVED" }), ctx({ guildId: GUILD_B, alertId: alert.id }));
    expect(res.status).toBe(403);
  });

  it("cannot reach another guild's alert through an authorised guild's URL", async () => {
    const foreign = await seedAlert(GUILD_B);
    const res = await alertRoute.PATCH(request("PATCH", { status: "RESOLVED" }), ctx({ guildId: GUILD_A, alertId: foreign.id }));
    expect(res.status).toBe(404);
    expect((await db.securityAlert.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe("OPEN");
  });

  it("returns 404 for guilds the user is not a member of", async () => {
    discordGuilds.mockResolvedValue(userGuilds({ [GUILD_A]: MANAGE_GUILD }));
    const res = await settingsRoute.PATCH(request("PATCH", { monitoringEnabled: false }), ctx({ guildId: GUILD_B }));
    expect(res.status).toBe(404);
  });

  it("ignores permissions claimed by the browser", async () => {
    // The request body cannot grant access: only Discord's server-side answer counts.
    const alert = await seedAlert(GUILD_B);
    const res = await alertRoute.PATCH(request("PATCH", { status: "RESOLVED", permissions: "8", owner: true }), ctx({ guildId: GUILD_B, alertId: alert.id }));
    expect([403, 422]).toContain(res.status);
    expect((await db.securityAlert.findUniqueOrThrow({ where: { id: alert.id } })).status).toBe("OPEN");
  });

  it("validates input and rejects unknown fields", async () => {
    const bad = await settingsRoute.PATCH(request("PATCH", { retentionDays: 99999 }), ctx({ guildId: GUILD_A }));
    expect(bad.status).toBe(422);
    const extra = await settingsRoute.PATCH(request("PATCH", { monitoringEnabled: true, guildId: GUILD_B }), ctx({ guildId: GUILD_A }));
    expect(extra.status).toBe(422);
  });

  it("refuses to trust a bot that only exists in another guild", async () => {
    await db.botInventory.create({ data: { guildId: GUILD_B, botUserId: "555555555555555555", username: "Other" } });
    const res = await trustRoute.PUT(request("PUT", { trusted: true }), ctx({ guildId: GUILD_A, botId: "555555555555555555" }));
    expect(res.status).toBe(404);
  });

  describe("emergency webhook deletion", () => {
    const WEBHOOK = "666666666666666666";
    beforeEach(async () => {
      deleteWebhook.mockReset();
      getWebhookGuildId.mockReset();
      await db.webhookInventory.create({ data: { guildId: GUILD_A, webhookId: WEBHOOK, name: "Deploys", type: 1, configHash: "x" } });
    });

    it("requires the exact webhook name", async () => {
      const res = await webhookRoute.DELETE(request("DELETE", { confirmName: "deploys" }), ctx({ guildId: GUILD_A, webhookId: WEBHOOK }));
      expect(res.status).toBe(422);
      expect(deleteWebhook).not.toHaveBeenCalled();
    });

    it("refuses when Discord says the webhook belongs to another guild", async () => {
      getWebhookGuildId.mockResolvedValue(GUILD_B);
      const res = await webhookRoute.DELETE(request("DELETE", { confirmName: "Deploys" }), ctx({ guildId: GUILD_A, webhookId: WEBHOOK }));
      expect(res.status).toBe(409);
      expect(deleteWebhook).not.toHaveBeenCalled();
    });

    it("deletes, records an audit event naming the administrator, and never returns secrets", async () => {
      getWebhookGuildId.mockResolvedValue(GUILD_A);
      const res = await webhookRoute.DELETE(request("DELETE", { confirmName: "Deploys", reason: "unexpected" }), ctx({ guildId: GUILD_A, webhookId: WEBHOOK }));
      expect(res.status).toBe(200);
      expect(deleteWebhook).toHaveBeenCalledWith(WEBHOOK, expect.stringContaining(USER));
      const text = await res.text();
      expect(text).not.toMatch(/token|webhooks\//i);
      const event = await db.auditEvent.findFirstOrThrow({ where: { type: "WEBHOOK_DELETED_BY_INTEGRIS" } });
      expect(event).toMatchObject({ guildId: GUILD_A, actorId: USER, targetId: WEBHOOK });
      expect((await db.webhookInventory.findFirstOrThrow()).status).toBe("DELETED");
    });

    it("cannot delete a webhook of another guild via an authorised guild's URL", async () => {
      await db.webhookInventory.create({ data: { guildId: GUILD_B, webhookId: "777777777777777777", name: "Theirs", type: 1, configHash: "x" } });
      const res = await webhookRoute.DELETE(request("DELETE", { confirmName: "Theirs" }), ctx({ guildId: GUILD_A, webhookId: "777777777777777777" }));
      expect(res.status).toBe(404);
      expect(deleteWebhook).not.toHaveBeenCalled();
    });
  });
});
