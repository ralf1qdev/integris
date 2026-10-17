import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission, type GuildContext } from "@integris/security";
import type { SafeWebhook } from "@integris/shared";

// Discord and Redis are external: replace them with in-memory fakes.
const delivered: string[] = [];
vi.mock("../src/queues", () => ({
  enqueueAlertDelivery: vi.fn(async (_g: string, id: string) => void delivered.push(id)),
  enqueueScan: vi.fn(),
}));
vi.mock("../src/discord", () => ({ getAuditLog: vi.fn(async () => null) }));

const { getPrisma, setTrust } = await import("@integris/database");
const { applyBots } = await import("../src/bots");
const { applyWebhooks } = await import("../src/webhooks");

const hasDb = Boolean(process.env.DATABASE_URL_TEST);
const db = getPrisma();
const GUILD = "111111111111111111";
const BOT = "222222222222222222";
const SELF = "999999999999999999";

const ctx = (botRolePerms: bigint): GuildContext => ({
  guildId: GUILD,
  ownerId: "1",
  roles: [
    { id: GUILD, name: "@everyone", position: 0, permissions: Permission.ViewChannel.toString(), managed: false },
    { id: "333333333333333333", name: "Helper", position: 2, permissions: botRolePerms.toString(), managed: true, botId: BOT },
  ],
  channels: [],
});
const bot = { userId: BOT, username: "helper", globalName: "Helper", avatar: null, roleIds: ["333333333333333333"], verified: true, joinedAt: new Date("2026-01-01T00:00:00Z") };
const webhook = (over: Partial<SafeWebhook> = {}): SafeWebhook => ({
  id: "444444444444444444",
  type: 1,
  channelId: "555555555555555555",
  name: "Deploys",
  avatar: null,
  applicationId: null,
  creatorId: "666666666666666666",
  creatorName: "alice",
  creatorIsBot: false,
  sourceGuildName: null,
  sourceChannelName: null,
  ...over,
});

async function settings() {
  return db.guildSettings.findUniqueOrThrow({ where: { guildId: GUILD } });
}

describe.skipIf(!hasDb)("monitoring pipeline", () => {
  beforeEach(async () => {
    delivered.length = 0;
    const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
    await db.guild.create({ data: { id: GUILD, name: "Alpha", botPresent: true, lastSyncAt: new Date() } });
    await db.guildSettings.create({ data: { guildId: GUILD, alertChannelId: "777777777777777777" } });
  });
  afterAll(() => db.$disconnect());

  it("baseline scans inventory without join events, and later joins raise one alert", async () => {
    const base = { settings: await settings(), selfId: SELF, source: "RECONCILIATION" as const, scope: "ALL" as const };
    await applyBots(db, GUILD, [bot], { ...base, ctx: ctx(Permission.SendMessages), baseline: true });
    expect(await db.auditEvent.count({ where: { type: "BOT_ADDED" } })).toBe(0);
    expect(await db.botInventory.count({ where: { isPresent: true } })).toBe(1);

    const other = { ...bot, userId: "888888888888888888", username: "spammer", globalName: null, joinedAt: new Date("2026-02-01T00:00:00Z") };
    await applyBots(db, GUILD, [bot, other], { ...base, ctx: ctx(Permission.SendMessages), baseline: false });
    const alerts = await db.securityAlert.findMany();
    expect(alerts.map((a) => a.title)).toEqual(["New bot detected"]);
    expect(delivered).toHaveLength(1);

    // Same state again: nothing new.
    await applyBots(db, GUILD, [bot, other], { ...base, ctx: ctx(Permission.SendMessages), baseline: false });
    expect(await db.securityAlert.count()).toBe(1);
  });

  it("detects escalation to Administrator and records the change", async () => {
    const base = { settings: await settings(), selfId: SELF, source: "GATEWAY" as const, scope: "ALL" as const, baseline: false };
    await applyBots(db, GUILD, [bot], { ...base, ctx: ctx(Permission.SendMessages), baseline: true });
    await applyBots(db, GUILD, [bot], { ...base, ctx: ctx(Permission.Administrator), cause: "Role Helper changed." });

    const types = (await db.auditEvent.findMany({ orderBy: { createdAt: "asc" } })).map((e) => e.type);
    expect(types).toEqual(["BOT_PERMISSIONS_CHANGED", "PERMISSION_ESCALATION"]);
    const alert = await db.securityAlert.findFirstOrThrow({ where: { title: "Suspicious permission escalation" } });
    expect(alert.severity).toBe("CRITICAL");
    const finding = await db.securityFinding.findFirstOrThrow({ where: { ruleId: "bot.administrator" } });
    expect(finding.status).toBe("OPEN");
  });

  it("does not alert when a trusted bot returns within its approved permissions", async () => {
    const base = { settings: await settings(), selfId: SELF, source: "GATEWAY" as const, scope: "ALL" as const, baseline: false };
    await applyBots(db, GUILD, [bot], { ...base, ctx: ctx(Permission.ManageWebhooks), baseline: true });
    await setTrust(db, { guildId: GUILD, kind: "BOT", targetId: BOT, trusted: true, actorId: "1", actorName: null });
    await applyBots(db, GUILD, [bot], { ...base, ctx: ctx(Permission.SendMessages) });
    await applyBots(db, GUILD, [bot], { ...base, ctx: ctx(Permission.ManageWebhooks) });
    expect(await db.securityAlert.count({ where: { title: "Suspicious permission escalation" } })).toBe(0);
  });

  it("marks bots that disappear from a full scan as removed and resolves their findings", async () => {
    const base = { settings: await settings(), selfId: SELF, source: "RECONCILIATION" as const, scope: "ALL" as const, baseline: false };
    await applyBots(db, GUILD, [bot], { ...base, ctx: ctx(Permission.Administrator), baseline: true });
    await applyBots(db, GUILD, [], { ...base, ctx: ctx(Permission.Administrator) });
    expect((await db.botInventory.findFirstOrThrow()).isPresent).toBe(false);
    expect(await db.securityFinding.count({ where: { status: "OPEN" } })).toBe(0);
    expect(await db.auditEvent.count({ where: { type: "BOT_REMOVED" } })).toBe(1);
  });

  it("tracks webhook creation, protected modification and deletion without storing tokens", async () => {
    const names = new Map([["555555555555555555", "deploys"]]);
    const opts = { channelNames: names, source: "GATEWAY" as const };
    await applyWebhooks(db, GUILD, [], { ...opts, settings: await settings(), baseline: true });

    const raw = { ...webhook(), token: "do-not-store", url: "https://discord.com/api/webhooks/444444444444444444/do-not-store" } as SafeWebhook;
    await applyWebhooks(db, GUILD, [raw], { ...opts, settings: await settings(), baseline: false });
    expect((await db.securityAlert.findFirstOrThrow()).title).toBe("Unexpected webhook created");
    expect((await db.auditEvent.findFirstOrThrow({ where: { type: "WEBHOOK_CREATED" } })).actorName).toBe("alice");

    await setTrust(db, { guildId: GUILD, kind: "WEBHOOK", targetId: raw.id, trusted: true, protected: true, actorId: "1", actorName: null });
    await applyWebhooks(db, GUILD, [webhook({ name: "Renamed" })], { ...opts, settings: await settings(), baseline: false });
    const modified = await db.securityAlert.findFirstOrThrow({ where: { title: "Protected webhook modified" } });
    expect(modified.severity).toBe("HIGH");
    expect((await db.auditEvent.findFirstOrThrow({ where: { type: "WEBHOOK_UPDATED" } })).actorName).toBeNull(); // Unknown, not invented

    await applyWebhooks(db, GUILD, [], { ...opts, settings: await settings(), baseline: false });
    expect((await db.webhookInventory.findFirstOrThrow()).status).toBe("DELETED");
    expect(await db.securityAlert.count({ where: { title: "Protected webhook deleted" } })).toBe(1);

    const dump = JSON.stringify([await db.webhookInventory.findMany(), await db.auditEvent.findMany(), await db.securityAlert.findMany()]);
    expect(dump).not.toContain("do-not-store");
  });

  it("raises HIGH for untrusted webhooks in restricted channels", async () => {
    await db.guildSettings.update({ where: { guildId: GUILD }, data: { restrictedChannelIds: ["555555555555555555"] } });
    await applyWebhooks(db, GUILD, [webhook()], { channelNames: new Map(), source: "RECONCILIATION", settings: await settings(), baseline: true });
    const finding = await db.securityFinding.findFirstOrThrow({ where: { ruleId: "webhook.restricted-channel" } });
    expect(finding.severity).toBe("HIGH");
    expect(await db.securityAlert.count({ where: { findingId: finding.id } })).toBe(1);
  });
});
