import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { attachTicketThread, closeTicket, findOpenTicket, reserveTicket } from "../src/repositories/community";
import { GUILD_A, GUILD_B, hasTestDb, resetDb, testClient, USER } from "./helpers";

const db = testClient();
const input = (guildId: string) => ({ guildId, openerId: USER, openerName: "alex", category: "setup", subject: "Help" });

describe.skipIf(!hasTestDb)("community tickets", () => {
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  it("numbers tickets per guild, including under concurrency", async () => {
    const tickets = await Promise.all(Array.from({ length: 5 }, () => reserveTicket(db, input(GUILD_A))));
    expect(tickets.map((t) => t.number).sort()).toEqual([1, 2, 3, 4, 5]);
    expect((await reserveTicket(db, input(GUILD_B))).number).toBe(1);
  });

  it("tracks the open ticket and closes it once", async () => {
    const t = await reserveTicket(db, input(GUILD_A));
    await attachTicketThread(db, t.id, "999999999999999999");
    expect((await findOpenTicket(db, GUILD_A, USER))?.id).toBe(t.id);
    expect(await closeTicket(db, { guildId: GUILD_B, threadId: "999999999999999999", closedById: USER })).toBeNull();
    expect((await closeTicket(db, { guildId: GUILD_A, threadId: "999999999999999999", closedById: USER }))?.status).toBe("CLOSED");
    expect(await closeTicket(db, { guildId: GUILD_A, threadId: "999999999999999999", closedById: USER })).toBeNull();
    expect(await findOpenTicket(db, GUILD_A, USER)).toBeNull();
  });
});
