import { describe, expect, it } from "vitest";
import { redactObject, redactSecrets, toSafeWebhook } from "../src/index";
import { buildAlertMessage, parseAlertButtonId, alertButtonId } from "../src/embeds";

const WEBHOOK_URL = "https://discord.com/api/webhooks/123456789012345678/abcDEF_ghi-JKL123456789abcdefghijklmnopqrstuvwxyz0123";
const FAKE_BOT_TOKEN = ["MTAxMjM0NTY3ODkwMTIzNDU2Nw", "GaBcDe", "abcdefghijklmnopqrstuvwxyz0123456789AB"].join(".");

describe("redactSecrets", () => {
  it("removes webhook tokens but keeps the webhook id", () => {
    const out = redactSecrets(`posting to ${WEBHOOK_URL} now`);
    expect(out).toContain("/webhooks/123456789012345678/[REDACTED]");
    expect(out).not.toContain("abcDEF_ghi");
  });

  it("handles discordapp.com and versioned API URLs", () => {
    const out = redactSecrets("https://discordapp.com/api/v10/webhooks/123456789012345678/secretTOKENvalue");
    expect(out).not.toContain("secretTOKENvalue");
  });

  it("removes bot tokens and authorization headers", () => {
    expect(redactSecrets(`token=${FAKE_BOT_TOKEN}`)).not.toContain(FAKE_BOT_TOKEN);
    expect(redactSecrets("Authorization: Bearer abcdefghijklmnopqrstuvwxyz")).toBe("Authorization: Bearer [REDACTED]");
  });
});

describe("redactObject", () => {
  it("redacts sensitive keys recursively", () => {
    const out = redactObject({ name: "x", token: "abc", nested: { accessToken: "y", list: [{ url: WEBHOOK_URL }] } });
    expect(out).toEqual({ name: "x", token: "[REDACTED]", nested: { accessToken: "[REDACTED]", list: [{ url: "[REDACTED]" }] } });
  });

  it("survives cycles", () => {
    const a: Record<string, unknown> = { n: 1 };
    a.self = a;
    expect(redactObject(a)).toEqual({ n: 1, self: "[Circular]" });
  });
});

describe("toSafeWebhook", () => {
  it("never carries the token or URL", () => {
    const safe = toSafeWebhook({
      id: "123456789012345678",
      type: 1,
      channel_id: "223456789012345678",
      name: "Deploys",
      avatar: null,
      application_id: null,
      token: "super-secret",
      url: WEBHOOK_URL,
      user: { id: "323456789012345678", username: "alice" },
    });
    const serialised = JSON.stringify(safe);
    expect(serialised).not.toContain("super-secret");
    expect(serialised).not.toContain("webhooks/");
    expect(safe.creatorName).toBe("alice");
  });
});

describe("alert messages", () => {
  const alert = {
    id: "clx0000000000000000000000",
    guildId: "123456789012345678",
    severity: "HIGH" as const,
    title: "Webhook created",
    description: `A webhook was created: ${WEBHOOK_URL}`,
    resourceType: "WEBHOOK" as const,
    resourceId: "123456789012345678",
    resourceName: "Deploys",
    recommendation: "Review it.",
    status: "OPEN" as const,
    evidence: { channel: "#general", token: "leak" },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    occurrences: 1,
  };

  it("redacts secrets in description and evidence", () => {
    const msg = buildAlertMessage(alert, "https://integris.example");
    const s = JSON.stringify(msg);
    expect(s).not.toContain("abcDEF_ghi");
    expect(s).not.toContain("leak");
    expect(msg.allowed_mentions.parse).toEqual([]);
  });

  it("drops action buttons once resolved", () => {
    const msg = buildAlertMessage({ ...alert, status: "RESOLVED", resolvedById: "1" }, "https://x");
    expect(msg.components[0]!.components.map((c) => c.label)).toEqual(["Open in dashboard"]);
  });

  it("round-trips button ids and rejects garbage", () => {
    expect(parseAlertButtonId(alertButtonId("ack", alert.id))).toEqual({ action: "ack", alertId: alert.id });
    expect(parseAlertButtonId("integris:alert:delete:abc")).toBeNull();
  });
});
