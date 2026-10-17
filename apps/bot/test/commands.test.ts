import { describe, expect, it } from "vitest";
import { commands } from "../src/commands";

const MANAGE_GUILD = (1n << 5n).toString();

describe("slash command definitions", () => {
  it("registers exactly the documented commands", () => {
    expect(commands.map((c) => c.data.name).sort()).toEqual(["alerts", "bots", "dashboard", "scan", "security", "setup", "webhooks"]);
  });

  it.each(commands.map((c) => [c.data.name, c] as const))("/%s requires Manage Server and is guild-only", (_name, c) => {
    expect(c.data.default_member_permissions).toBe(MANAGE_GUILD);
    expect(c.data.contexts).toEqual([0]);
  });
});
