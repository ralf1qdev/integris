import { describe, expect, it } from "vitest";
import { analyseEscalation, botEscalationAlert } from "../src/escalation";
import { ALL_PERMISSIONS, Permission } from "../src/permissions";

describe("analyseEscalation", () => {
  it("collapses Administrator to a single gained capability", () => {
    expect(analyseEscalation(Permission.SendMessages, ALL_PERMISSIONS).dangerousGained).toEqual(["Administrator"]);
  });

  it("ignores harmless gains", () => {
    expect(analyseEscalation(0n, Permission.AddReactions).dangerousGained).toEqual([]);
  });
});

describe("botEscalationAlert", () => {
  const input = { botId: "1", botName: "B", before: Permission.SendMessages, cause: "Role X changed." };

  it("returns null when nothing dangerous was gained", () => {
    expect(botEscalationAlert({ ...input, after: Permission.SendMessages | Permission.AttachFiles, trusted: false })).toBeNull();
  });

  it("rates admin escalation CRITICAL, or HIGH for trusted bots", () => {
    expect(botEscalationAlert({ ...input, after: ALL_PERMISSIONS, trusted: false })?.severity).toBe("CRITICAL");
    expect(botEscalationAlert({ ...input, after: ALL_PERMISSIONS, trusted: true })?.severity).toBe("HIGH");
  });

  it("rates other dangerous gains HIGH, or MEDIUM for trusted bots", () => {
    const after = Permission.SendMessages | Permission.ManageWebhooks;
    expect(botEscalationAlert({ ...input, after, trusted: false })?.severity).toBe("HIGH");
    expect(botEscalationAlert({ ...input, after, trusted: true })?.severity).toBe("MEDIUM");
  });

  it("dedups on the resulting permission set", () => {
    const after = Permission.ManageRoles;
    expect(botEscalationAlert({ ...input, after, trusted: false })?.dedupKey).toBe(
      botEscalationAlert({ ...input, before: 0n, after, trusted: false })?.dedupKey,
    );
  });
});
