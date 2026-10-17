import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addNote, setTrust } from "../src/repositories/trust";
import { raiseAlert, setAlertStatus, getAlert, listAlerts } from "../src/repositories/alerts";
import { setFindingStatus, syncFindings } from "../src/repositories/findings";
import { updateSettings } from "../src/repositories/settings";
import { getGuildOverview } from "../src/repositories/overview";
import { listEvents, recordEvent } from "../src/repositories/events";
import { deleteGuildData } from "../src/repositories/retention";
import { GUILD_A, GUILD_B, hasTestDb, resetDb, seedGuild, testClient, USER } from "./helpers";

const db = testClient();
const actor = { actorId: USER, actorName: "tester" };

const alertDraft = {
  dedupKey: "webhook-created:900000000000000001",
  severity: "MEDIUM" as const,
  title: "Unexpected webhook created",
  description: "d",
  recommendation: "r",
  resourceType: "WEBHOOK" as const,
  resourceId: "900000000000000001",
  resourceName: "Hook",
  evidence: {},
};

describe.skipIf(!hasTestDb)("guild data isolation", () => {
  beforeEach(async () => {
    await resetDb(db);
    await seedGuild(db, GUILD_A, "Alpha");
    await seedGuild(db, GUILD_B, "Beta");
  });
  afterAll(() => db.$disconnect());

  it("cannot read or change another guild's alert by ID", async () => {
    const { alert } = await raiseAlert(db, GUILD_B, alertDraft, { cooldownMinutes: 60 });
    expect(await getAlert(db, GUILD_A, alert.id)).toBeNull();
    expect(await setAlertStatus(db, { guildId: GUILD_A, alertId: alert.id, status: "RESOLVED", ...actor, source: "DASHBOARD" })).toBeNull();
    expect((await db.securityAlert.findUniqueOrThrow({ where: { id: alert.id } })).status).toBe("OPEN");
    expect((await listAlerts(db, GUILD_A)).items).toEqual([]);
  });

  it("cannot change another guild's finding", async () => {
    const { upserted } = await syncFindings(
      db,
      GUILD_B,
      [{ ruleId: "bot.administrator", severity: "HIGH", title: "t", description: "d", recommendation: "r", targetType: "BOT", targetId: "555555555555555555", targetName: "B", evidence: {} }],
      [{ targetType: "BOT", targetIds: "ALL" }],
    );
    const id = upserted[0]!.finding.id;
    expect(await setFindingStatus(db, { guildId: GUILD_A, findingId: id, status: "RESOLVED", ...actor })).toBeNull();
  });

  it("cannot trust or annotate an integration that belongs to another guild", async () => {
    await db.botInventory.create({ data: { guildId: GUILD_B, botUserId: "555555555555555555", username: "OtherBot" } });
    expect(await setTrust(db, { guildId: GUILD_A, kind: "BOT", targetId: "555555555555555555", trusted: true, ...actor })).toEqual({ error: "NOT_FOUND" });
    expect(await addNote(db, { guildId: GUILD_A, kind: "BOT", targetId: "555555555555555555", body: "x", authorId: USER, authorName: null })).toEqual({ error: "NOT_FOUND" });
    expect(await db.trustedIntegration.count()).toBe(0);
  });

  it("rejects alert channels that belong to another guild", async () => {
    await db.guildChannel.create({ data: { id: "666666666666666666", guildId: GUILD_B, name: "alerts", type: 0 } });
    const r = await updateSettings(db, GUILD_A, { alertChannelId: "666666666666666666" }, { id: USER, name: null, source: "DASHBOARD" });
    expect(r).toEqual({ error: "UNKNOWN_CHANNEL" });
  });

  it("keeps overview counts and event feeds per guild", async () => {
    await db.botInventory.create({ data: { guildId: GUILD_B, botUserId: "555555555555555555", username: "OtherBot" } });
    await recordEvent(db, GUILD_B, { type: "BOT_ADDED", source: "GATEWAY", summary: "x" });
    const o = await getGuildOverview(db, GUILD_A);
    expect(o.botCount).toBe(0);
    expect(o.recentEvents).toEqual([]);
    expect((await listEvents(db, GUILD_A)).items).toEqual([]);
  });

  it("allows the same event dedup key in two guilds but not twice in one", async () => {
    const a = await recordEvent(db, GUILD_A, { type: "WEBHOOK_CREATED", source: "GATEWAY", summary: "x", dedupKey: "k" });
    const b = await recordEvent(db, GUILD_B, { type: "WEBHOOK_CREATED", source: "GATEWAY", summary: "x", dedupKey: "k" });
    const again = await recordEvent(db, GUILD_A, { type: "WEBHOOK_CREATED", source: "GATEWAY", summary: "x", dedupKey: "k" });
    expect(a.created && b.created).toBe(true);
    expect(again).toMatchObject({ created: false, event: { id: a.event.id } });
  });

  it("deletes one guild's data without touching another", async () => {
    await raiseAlert(db, GUILD_A, alertDraft, { cooldownMinutes: 60 });
    await raiseAlert(db, GUILD_B, alertDraft, { cooldownMinutes: 60 });
    await deleteGuildData(db, { guildId: GUILD_A, requestedById: USER, leftGuild: true });
    expect(await db.guild.findUnique({ where: { id: GUILD_A } })).toBeNull();
    expect(await db.securityAlert.count({ where: { guildId: GUILD_A } })).toBe(0);
    expect(await db.securityAlert.count({ where: { guildId: GUILD_B } })).toBe(1);
    expect(await db.dataDeletionLog.count({ where: { guildId: GUILD_A, completedAt: { not: null } } })).toBe(1);
  });
});
