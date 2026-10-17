import { describe, expect, it } from "vitest";
import type { SafeWebhook } from "@integris/shared";
import {
  diffWebhooks,
  evaluateWebhook,
  webhookConfigHash,
  webhookCreatedAlert,
  webhookDeletedAlert,
  webhookUpdatedAlert,
  type StoredWebhook,
} from "../src/webhook";

const wh = (over: Partial<SafeWebhook> = {}): SafeWebhook => ({
  id: "900000000000000001",
  type: 1,
  channelId: "800000000000000001",
  name: "Deploys",
  avatar: null,
  applicationId: null,
  creatorId: "700000000000000001",
  creatorName: "alice",
  creatorIsBot: false,
  sourceGuildName: null,
  sourceChannelName: null,
  ...over,
});
const stored = (w: SafeWebhook): StoredWebhook => ({
  webhookId: w.id,
  name: w.name,
  channelId: w.channelId,
  avatar: w.avatar,
  configHash: webhookConfigHash(w),
});
const ctx = (over: Partial<Parameters<typeof evaluateWebhook>[1]> = {}) => ({
  channelName: "deploys",
  trust: null,
  restrictedChannelIds: new Set<string>(),
  ...over,
});
const settings = { alertOnWebhookCreate: true, alertOnWebhookDelete: true };

describe("evaluateWebhook", () => {
  it("only marks an ordinary untrusted webhook as unreviewed (INFO)", () => {
    expect(evaluateWebhook(wh(), ctx()).map((f) => [f.ruleId, f.severity])).toEqual([["webhook.unreviewed", "INFO"]]);
  });

  it("flags untrusted webhooks in restricted channels as HIGH", () => {
    const f = evaluateWebhook(wh(), ctx({ restrictedChannelIds: new Set(["800000000000000001"]) }));
    expect(f.find((x) => x.ruleId === "webhook.restricted-channel")?.severity).toBe("HIGH");
  });

  it("produces no findings once trusted", () => {
    expect(evaluateWebhook(wh({ creatorIsBot: true }), ctx({ trust: { protected: false }, restrictedChannelIds: new Set(["800000000000000001"]) }))).toEqual([]);
  });

  it("flags incoming webhooks created by bots", () => {
    expect(evaluateWebhook(wh({ creatorIsBot: true }), ctx()).map((f) => f.ruleId)).toContain("webhook.created-by-bot");
  });

  it("never includes a token or URL in findings", () => {
    const raw = { ...wh(), token: "secret-token", url: "https://discord.com/api/webhooks/1/secret-token" } as SafeWebhook;
    expect(JSON.stringify(evaluateWebhook(raw, ctx()))).not.toContain("secret-token");
  });
});

describe("diffWebhooks", () => {
  it("detects created, updated and deleted webhooks", () => {
    const a = wh();
    const b = wh({ id: "900000000000000002", name: "Old" });
    const c = wh({ id: "900000000000000003" });
    const d = diffWebhooks([stored(a), stored(b), stored(c)], [a, { ...b, name: "New" }, wh({ id: "900000000000000004" })]);
    expect(d.created.map((x) => x.id)).toEqual(["900000000000000004"]);
    expect(d.updated.map((x) => [x.after.id, x.changed])).toEqual([["900000000000000002", ["name"]]]);
    expect(d.deleted.map((x) => x.webhookId)).toEqual(["900000000000000003"]);
  });

  it("limits deletion detection to the re-fetched channels", () => {
    const a = wh({ channelId: "800000000000000009" });
    expect(diffWebhooks([stored(a)], [], new Set(["800000000000000001"])).deleted).toEqual([]);
    expect(diffWebhooks([stored(a)], [], new Set(["800000000000000009"])).deleted).toHaveLength(1);
  });
});

describe("webhook alerts", () => {
  it("raises MEDIUM for unexpected creation and HIGH in restricted channels", () => {
    expect(webhookCreatedAlert(wh(), ctx(), settings, null)?.severity).toBe("MEDIUM");
    expect(webhookCreatedAlert(wh(), ctx({ restrictedChannelIds: new Set(["800000000000000001"]) }), settings, "bob")?.evidence.createdBy).toBe("bob");
  });

  it("respects settings", () => {
    expect(webhookCreatedAlert(wh(), ctx(), { ...settings, alertOnWebhookCreate: false }, null)).toBeNull();
    expect(webhookDeletedAlert(stored(wh()), ctx(), { ...settings, alertOnWebhookDelete: false }, null)).toBeNull();
  });

  it("protected webhook deletion alerts even when delete alerts are off", () => {
    expect(webhookDeletedAlert(stored(wh()), ctx({ trust: { protected: true } }), { ...settings, alertOnWebhookDelete: false }, null)?.severity).toBe("HIGH");
  });

  it("only alerts on modification of protected webhooks, reporting Unknown actors honestly", () => {
    const before = stored(wh());
    const after = wh({ name: "Renamed" });
    expect(webhookUpdatedAlert(before, after, ["name"], ctx(), null)).toBeNull();
    const a = webhookUpdatedAlert(before, after, ["name"], ctx({ trust: { protected: true } }), null);
    expect(a?.severity).toBe("HIGH");
    expect(a?.evidence.changedBy).toBe("Unknown");
  });
});
