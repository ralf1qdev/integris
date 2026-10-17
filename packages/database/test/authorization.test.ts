import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeGuildAccess, canManageGuild, type DiscordUserGuild } from "../src/repositories/access";
import { markGuildRemoved } from "../src/repositories/guilds";
import {
  ADMINISTRATOR,
  GUILD_A,
  GUILD_B,
  hasTestDb,
  MANAGE_GUILD,
  resetDb,
  seedGuild,
  seedUser,
  SEND_MESSAGES,
  testClient,
  USER,
} from "./helpers";

const db = testClient();
const g = (id: string, permissions: string, owner = false): DiscordUserGuild => ({ id, name: id, icon: null, owner, permissions });

describe.skipIf(!hasTestDb)("authorizeGuildAccess", () => {
  beforeEach(async () => {
    await resetDb(db);
    await seedUser(db, USER);
    await seedGuild(db, GUILD_A, "Alpha");
    await seedGuild(db, GUILD_B, "Beta");
  });
  afterAll(() => db.$disconnect());

  it("allows a member with Manage Server", async () => {
    const r = await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_A, fetchUserGuilds: async () => [g(GUILD_A, MANAGE_GUILD)] });
    expect(r.ok).toBe(true);
  });

  it("allows owners and administrators", async () => {
    expect(canManageGuild({ owner: true, permissions: "0" })).toBe(true);
    expect(canManageGuild({ owner: false, permissions: ADMINISTRATOR })).toBe(true);
    expect(canManageGuild({ owner: false, permissions: SEND_MESSAGES })).toBe(false);
  });

  it("denies members without management permissions", async () => {
    const r = await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_A, fetchUserGuilds: async () => [g(GUILD_A, SEND_MESSAGES)] });
    expect(r).toMatchObject({ ok: false, reason: "FORBIDDEN" });
  });

  it("denies users who are not in the guild, even if they manage another guild", async () => {
    const r = await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_B, fetchUserGuilds: async () => [g(GUILD_A, ADMINISTRATOR)] });
    expect(r).toMatchObject({ ok: false, reason: "NOT_MEMBER" });
  });

  it("rejects malformed guild IDs before any lookup", async () => {
    const fetch = vi.fn();
    const r = await authorizeGuildAccess(db, { userId: USER, guildId: "1 OR 1=1", fetchUserGuilds: fetch });
    expect(r).toMatchObject({ ok: false, reason: "INVALID_GUILD" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports NOT_INSTALLED when Integris is not in the guild", async () => {
    await markGuildRemoved(db, GUILD_A);
    const r = await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_A, fetchUserGuilds: async () => [g(GUILD_A, MANAGE_GUILD)] });
    expect(r).toMatchObject({ ok: false, reason: "NOT_INSTALLED" });
  });

  it("caches Discord's answer within the TTL and re-verifies after it", async () => {
    const fetch = vi.fn(async () => [g(GUILD_A, MANAGE_GUILD)]);
    const t0 = new Date("2026-01-01T00:00:00Z");
    await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_A, fetchUserGuilds: fetch, now: t0 });
    await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_A, fetchUserGuilds: fetch, now: new Date(t0.getTime() + 60_000) });
    expect(fetch).toHaveBeenCalledTimes(1);

    // Permission revoked in Discord: the next verification after the TTL must deny.
    fetch.mockResolvedValueOnce([g(GUILD_A, SEND_MESSAGES)]);
    const r = await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_A, fetchUserGuilds: fetch, now: new Date(t0.getTime() + 10 * 60_000) });
    expect(r).toMatchObject({ ok: false, reason: "FORBIDDEN" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("removes cached access for guilds the user left", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_A, fetchUserGuilds: async () => [g(GUILD_A, MANAGE_GUILD), g(GUILD_B, MANAGE_GUILD)], now: t0 });
    expect(await db.guildAccess.count({ where: { userId: USER } })).toBe(2);
    await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_A, fetchUserGuilds: async () => [g(GUILD_A, MANAGE_GUILD)], now: new Date(t0.getTime() + 10 * 60_000) });
    expect(await db.guildAccess.findMany({ where: { userId: USER }, select: { guildId: true } })).toEqual([{ guildId: GUILD_A }]);
  });

  it("drops every cached grant when Integris is removed from a guild", async () => {
    await authorizeGuildAccess(db, { userId: USER, guildId: GUILD_A, fetchUserGuilds: async () => [g(GUILD_A, MANAGE_GUILD)] });
    await markGuildRemoved(db, GUILD_A);
    expect(await db.guildAccess.count({ where: { guildId: GUILD_A } })).toBe(0);
  });
});
