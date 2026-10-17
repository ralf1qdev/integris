import { describe, expect, it } from "vitest";
import { evaluateBot } from "../src/bot";
import { Permission } from "../src/permissions";
import { BOT, ctx, GUILD, role } from "./fixtures";

const bot = (roleIds: string[], verified: boolean | null = true) => ({ userId: BOT, username: "HelperBot", roleIds, verified });

describe("evaluateBot", () => {
  it("produces no findings for a bot with ordinary permissions", () => {
    const r = evaluateBot(ctx([role("1", "Helper", 1, Permission.SendMessages | Permission.EmbedLinks)]), bot(["1"]));
    expect(r.findings).toEqual([]);
    expect(r.riskLevel).toBe("NONE");
  });

  it("flags Administrator as HIGH for a verified bot and lists the granting role", () => {
    const r = evaluateBot(ctx([role("1", "Admin Bot", 3, Permission.Administrator)]), bot(["1"]));
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ ruleId: "bot.administrator", severity: "HIGH", evidence: { grantedBy: ["Admin Bot"] } });
    expect(r.riskLevel).toBe("HIGH");
    expect(r.isAdministrator).toBe(true);
  });

  it("escalates Administrator to CRITICAL only when the bot is known to be unverified", () => {
    const c = ctx([role("1", "A", 3, Permission.Administrator)]);
    expect(evaluateBot(c, bot(["1"], false)).findings[0]!.severity).toBe("CRITICAL");
    expect(evaluateBot(c, bot(["1"], null)).findings[0]!.severity).toBe("HIGH");
  });

  it("reports each dangerous permission separately with its documented severity", () => {
    const perms = Permission.ManageWebhooks | Permission.KickMembers | Permission.MentionEveryone;
    const r = evaluateBot(ctx([role("1", "R", 1, perms)]), bot(["1"]));
    const byRule = Object.fromEntries(r.findings.map((f) => [f.ruleId, f.severity]));
    expect(byRule).toEqual({
      "bot.permission.ManageWebhooks": "MEDIUM",
      "bot.permission.KickMembers": "LOW",
      "bot.permission.MentionEveryone": "LOW",
    });
    expect(r.riskLevel).toBe("MEDIUM");
  });

  it("detects a role-hierarchy escalation path when Manage Roles sits above an admin role", () => {
    const c = ctx([
      role("1", "Bot Role", 10, Permission.ManageRoles),
      role("2", "Moderators", 5, Permission.Administrator),
      role("3", "Integration", 4, Permission.Administrator, { managed: true }),
    ]);
    const f = evaluateBot(c, bot(["1"])).findings.find((x) => x.ruleId === "bot.role-hierarchy");
    expect(f?.severity).toBe("HIGH");
    expect(f?.evidence.assignableRoles).toEqual(["Moderators"]); // managed roles cannot be assigned
  });

  it("does not flag hierarchy when powerful roles are above the bot", () => {
    const c = ctx([role("1", "Bot Role", 2, Permission.ManageRoles), role("2", "Admins", 9, Permission.Administrator)]);
    expect(evaluateBot(c, bot(["1"])).findings.some((x) => x.ruleId === "bot.role-hierarchy")).toBe(false);
  });

  it("reports channel overwrites that add sensitive permissions", () => {
    const c = ctx([role("1", "Bot Role", 1, 0n)], [
      {
        id: "c1",
        name: "announcements",
        type: 0,
        permissionOverwrites: [{ id: BOT, type: 1, allow: (Permission.ManageWebhooks | Permission.MentionEveryone).toString(), deny: "0" }],
      },
      { id: "c2", name: "general", type: 0, permissionOverwrites: [] },
    ]);
    const r = evaluateBot(c, bot(["1"]));
    expect(r.channelElevations).toEqual([{ channelId: "c1", channelName: "announcements", gained: ["ManageWebhooks", "MentionEveryone"] }]);
    expect(r.findings.find((f) => f.ruleId === "bot.channel-overwrite")?.severity).toBe("MEDIUM");
  });

  it("adds an unverified finding only alongside elevated permissions", () => {
    expect(evaluateBot(ctx([role("1", "R", 1, Permission.SendMessages)]), bot(["1"], false)).findings).toEqual([]);
    const r = evaluateBot(ctx([role("1", "R", 1, Permission.BanMembers)]), bot(["1"], false));
    expect(r.findings.map((f) => f.ruleId)).toContain("bot.unverified-privileged");
  });

  it("is deterministic", () => {
    const c = ctx([role("1", "R", 1, Permission.ManageGuild | Permission.ManageChannels)]);
    expect(evaluateBot(c, bot(["1"]))).toEqual(evaluateBot(c, bot(["1"])));
  });

  it("uses @everyone permissions too", () => {
    const c = ctx([]);
    c.roles[0]!.permissions = (Permission.ViewChannel | Permission.MentionEveryone).toString();
    expect(evaluateBot(c, bot([])).findings.map((f) => f.evidence.grantedBy)).toEqual([["@everyone"]]);
    expect(GUILD).toBe(c.roles[0]!.id);
  });
});
