import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  computeBasePermissions,
  computeChannelPermissions,
  diffPermissions,
  highestRole,
  Permission,
  permissionNames,
} from "../src/permissions";
import { BOT, ctx, GUILD, OWNER, role } from "./fixtures";

describe("computeBasePermissions", () => {
  it("combines @everyone with every held role", () => {
    const c = ctx([role("1", "A", 1, Permission.KickMembers), role("2", "B", 2, Permission.BanMembers)]);
    const p = computeBasePermissions(c, BOT, ["1", "2"]);
    expect(permissionNames(p)).toEqual(["KickMembers", "BanMembers", "ViewChannel", "SendMessages"]);
  });

  it("ignores roles the member does not hold", () => {
    const c = ctx([role("1", "A", 1, Permission.Administrator)]);
    expect(computeBasePermissions(c, BOT, [])).toBe(Permission.ViewChannel | Permission.SendMessages);
  });

  it("expands Administrator and grants the owner everything", () => {
    const c = ctx([role("1", "A", 1, Permission.Administrator)]);
    expect(computeBasePermissions(c, BOT, ["1"])).toBe(ALL_PERMISSIONS);
    expect(computeBasePermissions(c, OWNER, [])).toBe(ALL_PERMISSIONS);
  });
});

describe("computeChannelPermissions", () => {
  const roles = [role("1", "Bots", 1, 0n)];
  const base = Permission.ViewChannel | Permission.SendMessages;

  it("applies @everyone, then role, then member overwrites", () => {
    const c = ctx(roles, [
      {
        id: "c1",
        name: "ops",
        type: 0,
        permissionOverwrites: [
          { id: GUILD, type: 0, allow: "0", deny: Permission.SendMessages.toString() },
          { id: "1", type: 0, allow: Permission.ManageWebhooks.toString(), deny: "0" },
          { id: BOT, type: 1, allow: Permission.SendMessages.toString(), deny: Permission.ManageWebhooks.toString() },
        ],
      },
    ]);
    const p = computeChannelPermissions(c, base, c.channels[0]!, BOT, ["1"]);
    expect(permissionNames(p)).toEqual(["ViewChannel", "SendMessages"]);
  });

  it("role deny wins over role allow only across roles in aggregate", () => {
    const c = ctx([role("1", "A", 1, 0n), role("2", "B", 2, 0n)], [
      {
        id: "c1",
        name: "x",
        type: 0,
        permissionOverwrites: [
          { id: "1", type: 0, allow: Permission.ManageWebhooks.toString(), deny: "0" },
          { id: "2", type: 0, allow: "0", deny: Permission.ManageWebhooks.toString() },
        ],
      },
    ]);
    // Discord: deny bits are removed first, then allow bits are added — allow wins.
    const p = computeChannelPermissions(c, base, c.channels[0]!, BOT, ["1", "2"]);
    expect(p & Permission.ManageWebhooks).toBe(Permission.ManageWebhooks);
  });

  it("returns nothing without View Channel", () => {
    const c = ctx(roles, [
      { id: "c1", name: "x", type: 0, permissionOverwrites: [{ id: GUILD, type: 0, allow: "0", deny: Permission.ViewChannel.toString() }] },
    ]);
    expect(computeChannelPermissions(c, base | Permission.ManageWebhooks, c.channels[0]!, BOT, [])).toBe(0n);
  });

  it("administrators bypass overwrites", () => {
    const c = ctx(roles, [
      { id: "c1", name: "x", type: 0, permissionOverwrites: [{ id: BOT, type: 1, allow: "0", deny: Permission.ViewChannel.toString() }] },
    ]);
    expect(computeChannelPermissions(c, ALL_PERMISSIONS, c.channels[0]!, BOT, [])).toBe(ALL_PERMISSIONS);
  });
});

describe("highestRole", () => {
  it("picks the highest position and breaks ties by lower id", () => {
    const c = ctx([role("300", "Low", 1, 0n), role("500", "TieB", 5, 0n), role("400", "TieA", 5, 0n)]);
    expect(highestRole(c, ["300", "500", "400"])?.name).toBe("TieA");
  });

  it("ignores @everyone", () => {
    expect(highestRole(ctx([]), [GUILD])).toBeNull();
  });
});

describe("diffPermissions", () => {
  it("reports gained and lost bits", () => {
    const d = diffPermissions(Permission.KickMembers | Permission.ViewChannel, Permission.ViewChannel | Permission.BanMembers);
    expect(d).toEqual({ gained: ["BanMembers"], lost: ["KickMembers"] });
  });
});
