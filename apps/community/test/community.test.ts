import { describe, expect, it } from "vitest";
import { TICKET_CATEGORIES } from "../src/config";
import { POSTS, postEmbeds, type PostKey } from "../src/content";
import { BurstGuard, canCloseTicket, formatDuration, ticketThreadName } from "../src/helpers";

const links = { app: "https://integris.test", channel: (k: string) => `#${k}` };

describe("information posts", () => {
  it.each(Object.keys(POSTS) as PostKey[])("%s stays within Discord embed limits", (key) => {
    for (const e of postEmbeds(key, links)) {
      expect(e.title?.length ?? 0).toBeLessThanOrEqual(256);
      expect(e.description?.length ?? 0).toBeLessThanOrEqual(4096);
      expect(e.fields?.length ?? 0).toBeLessThanOrEqual(25);
      for (const f of e.fields ?? []) {
        expect(f.name.length).toBeLessThanOrEqual(256);
        expect(f.value.length).toBeLessThanOrEqual(1024);
      }
      const total = (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.footer?.text.length ?? 0) + (e.fields ?? []).reduce((n, f) => n + f.name.length + f.value.length, 0);
      expect(total).toBeLessThanOrEqual(6000);
      expect(e.footer?.text).toContain(POSTS[key].label);
    }
  });

  it("has at most 5 ticket buttons (one action row)", () => {
    expect(Object.keys(TICKET_CATEGORIES).length).toBeLessThanOrEqual(5);
  });
});

describe("ticket helpers", () => {
  it("builds safe, numbered thread names", () => {
    expect(ticketThreadName(7, "Alex 🚀")).toBe("ticket-0007-alex");
    expect(ticketThreadName(12, "@@@")).toBe("ticket-0012-user");
  });

  it("lets only the opener or thread managers close", () => {
    expect(canCloseTicket({ userId: "1", openerId: "1", canManageThreads: false })).toBe(true);
    expect(canCloseTicket({ userId: "2", openerId: "1", canManageThreads: true })).toBe(true);
    expect(canCloseTicket({ userId: "2", openerId: "1", canManageThreads: false })).toBe(false);
  });

  it("formats durations", () => {
    expect(formatDuration(5 * 60_000)).toBe("5 min");
    expect(formatDuration(3 * 3600_000)).toBe("3 h");
    expect(formatDuration(5 * 86_400_000)).toBe("5 days");
  });
});

describe("BurstGuard", () => {
  it("pauses after the limit and recovers when the window passes", () => {
    const g = new BurstGuard(2, 1000);
    expect([g.allow(0), g.allow(10), g.allow(20)]).toEqual([true, true, false]);
    expect(g.allow(2000)).toBe(true);
  });
});
