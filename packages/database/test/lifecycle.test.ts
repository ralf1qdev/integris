import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FindingDraft } from "@integris/security";
import { raiseAlert, setAlertStatus } from "../src/repositories/alerts";
import { syncFindings } from "../src/repositories/findings";
import { createScanJob } from "../src/repositories/scans";
import { activitySeries, recordEvent } from "../src/repositories/events";
import { purgeExpiredData } from "../src/repositories/retention";
import { GUILD_A, hasTestDb, resetDb, seedGuild, testClient, USER } from "./helpers";

const db = testClient();
const draft = (over: Partial<FindingDraft> = {}): FindingDraft => ({
  ruleId: "bot.permission.ManageWebhooks",
  severity: "MEDIUM",
  title: "Bot can Manage Webhooks",
  description: "d",
  recommendation: "r",
  targetType: "BOT",
  targetId: "555555555555555555",
  targetName: "B",
  evidence: { grantedBy: ["Role"] },
  ...over,
});
const ALL = [{ targetType: "BOT" as const, targetIds: "ALL" as const }];

describe.skipIf(!hasTestDb)("finding & alert lifecycle", () => {
  beforeEach(async () => {
    await resetDb(db);
    await seedGuild(db, GUILD_A, "Alpha");
  });
  afterAll(() => db.$disconnect());

  it("creates, keeps, auto-resolves and reopens findings", async () => {
    expect((await syncFindings(db, GUILD_A, [draft()], ALL)).upserted[0]!.transition).toBe("created");
    expect((await syncFindings(db, GUILD_A, [draft()], ALL)).upserted[0]!.transition).toBe("unchanged");
    expect((await syncFindings(db, GUILD_A, [draft({ evidence: { grantedBy: ["Other"] } })], ALL)).upserted[0]!.transition).toBe("changed");
    const resolved = await syncFindings(db, GUILD_A, [], ALL);
    expect(resolved.autoResolved).toHaveLength(1);
    expect((await syncFindings(db, GUILD_A, [draft()], ALL)).upserted[0]!.transition).toBe("reopened");
  });

  it("only auto-resolves findings within the evaluated scope", async () => {
    await syncFindings(db, GUILD_A, [draft(), draft({ targetId: "666666666666666666" })], ALL);
    const r = await syncFindings(db, GUILD_A, [], [{ targetType: "BOT", targetIds: ["555555555555555555"] }]);
    expect(r.autoResolved.map((f) => f.targetId)).toEqual(["555555555555555555"]);
  });

  it("re-opens acknowledged findings when severity increases", async () => {
    const { upserted } = await syncFindings(db, GUILD_A, [draft()], ALL);
    await db.securityFinding.update({ where: { id: upserted[0]!.finding.id }, data: { status: "ACKNOWLEDGED" } });
    const r = await syncFindings(db, GUILD_A, [draft({ severity: "HIGH" })], ALL);
    expect(r.upserted[0]!.finding.status).toBe("OPEN");
  });

  it("deduplicates alerts while active and honours the cooldown after resolution", async () => {
    const d = { dedupKey: "k", severity: "HIGH" as const, title: "t", description: "d", recommendation: "r", resourceType: "BOT" as const, resourceId: "1", resourceName: "B", evidence: {} };
    const t0 = new Date("2026-01-01T00:00:00Z");
    const first = await raiseAlert(db, GUILD_A, d, { cooldownMinutes: 60, now: t0 });
    const dup = await raiseAlert(db, GUILD_A, d, { cooldownMinutes: 60, now: new Date(t0.getTime() + 1000) });
    expect(first.created).toBe(true);
    expect(dup).toMatchObject({ created: false, alert: { id: first.alert.id, occurrences: 2 } });

    await setAlertStatus(db, { guildId: GUILD_A, alertId: first.alert.id, status: "RESOLVED", actorId: USER, actorName: null, source: "DASHBOARD" });
    expect((await raiseAlert(db, GUILD_A, d, { cooldownMinutes: 60, now: new Date(t0.getTime() + 30 * 60_000) })).created).toBe(false);
    expect((await raiseAlert(db, GUILD_A, d, { cooldownMinutes: 60, now: new Date(t0.getTime() + 3 * 3600_000) })).created).toBe(true);
  });

  it("auto-resolves alerts linked to findings that disappear", async () => {
    const { upserted } = await syncFindings(db, GUILD_A, [draft()], ALL);
    const { alert } = await raiseAlert(
      db,
      GUILD_A,
      { dedupKey: "f", severity: "MEDIUM", title: "t", description: "d", recommendation: "r", resourceType: "BOT", resourceId: "1", resourceName: null, evidence: {}, findingId: upserted[0]!.finding.id },
      { cooldownMinutes: 60 },
    );
    await syncFindings(db, GUILD_A, [], ALL);
    expect((await db.securityAlert.findUniqueOrThrow({ where: { id: alert.id } })).status).toBe("RESOLVED");
  });

  it("collapses concurrent scan requests and rate limits manual scans", async () => {
    const a = await createScanJob(db, { guildId: GUILD_A, trigger: "DASHBOARD", requestedById: USER });
    const b = await createScanJob(db, { guildId: GUILD_A, trigger: "COMMAND", requestedById: USER });
    expect(a.status).toBe("created");
    expect(b.status).toBe("already_pending");
    await db.scanJob.updateMany({ data: { status: "SUCCEEDED" } });
    expect((await createScanJob(db, { guildId: GUILD_A, trigger: "DASHBOARD" })).status).toBe("cooldown");
    expect((await createScanJob(db, { guildId: GUILD_A, trigger: "SCHEDULED" })).status).toBe("created");
  });

  it("returns real zero-filled activity buckets", async () => {
    const now = new Date("2026-01-10T12:30:00Z");
    await recordEvent(db, GUILD_A, { type: "BOT_ADDED", source: "GATEWAY", summary: "x", occurredAt: new Date("2026-01-10T11:10:00Z") });
    await recordEvent(db, GUILD_A, { type: "BOT_ADDED", source: "GATEWAY", summary: "y", occurredAt: new Date("2026-01-10T11:50:00Z") });
    const series = await activitySeries(db, GUILD_A, "24h", now);
    expect(series).toHaveLength(24);
    expect(series.reduce((n, p) => n + p.events, 0)).toBe(2);
    expect(series.find((p) => p.bucket === "2026-01-10T11:00:00.000Z")?.events).toBe(2);
  });

  it("purges history older than the retention period but keeps open alerts", async () => {
    const old = new Date(Date.now() - 200 * 86_400_000);
    await recordEvent(db, GUILD_A, { type: "BOT_ADDED", source: "GATEWAY", summary: "old", occurredAt: old });
    await recordEvent(db, GUILD_A, { type: "BOT_ADDED", source: "GATEWAY", summary: "new" });
    await db.securityAlert.create({
      data: { guildId: GUILD_A, dedupKey: "o", severity: "LOW", title: "t", description: "d", recommendation: "r", resourceType: "BOT", evidence: {}, createdAt: old },
    });
    await purgeExpiredData(db);
    expect(await db.auditEvent.count()).toBe(1);
    expect(await db.securityAlert.count()).toBe(1);
  });
});
