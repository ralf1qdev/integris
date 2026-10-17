import type { IntegrationKind } from "@integris/shared";
import type { Db } from "../client";
import { recordEvent } from "./events";

async function targetExists(db: Db, guildId: string, kind: IntegrationKind, targetId: string) {
  if (kind === "BOT") {
    const bot = await db.botInventory.findUnique({ where: { guildId_botUserId: { guildId, botUserId: targetId } } });
    return bot ? { name: bot.username, permissions: bot.permissions } : null;
  }
  const wh = await db.webhookInventory.findUnique({ where: { guildId_webhookId: { guildId, webhookId: targetId } } });
  return wh ? { name: wh.name ?? "Unnamed webhook", permissions: null } : null;
}

/**
 * Grants or revokes local trust. The target must exist in *this* guild's inventory,
 * so trust can never be attached to another guild's integration.
 */
export async function setTrust(
  db: Db,
  input: {
    guildId: string;
    kind: IntegrationKind;
    targetId: string;
    trusted: boolean;
    protected?: boolean;
    note?: string;
    actorId: string;
    actorName: string | null;
  },
) {
  const target = await targetExists(db, input.guildId, input.kind, input.targetId);
  if (!target) return { error: "NOT_FOUND" as const };
  const where = { guildId_kind_targetId: { guildId: input.guildId, kind: input.kind, targetId: input.targetId } };

  if (!input.trusted) {
    const { count } = await db.trustedIntegration.deleteMany({ where: { guildId: input.guildId, kind: input.kind, targetId: input.targetId } });
    if (count) {
      await recordEvent(db, input.guildId, {
        type: "TRUST_REVOKED",
        source: "DASHBOARD",
        actorId: input.actorId,
        actorName: input.actorName,
        targetType: input.kind,
        targetId: input.targetId,
        targetName: target.name,
        summary: `${target.name} is no longer trusted`,
      });
    }
    return { trust: null };
  }

  const data = {
    protected: input.kind === "WEBHOOK" ? Boolean(input.protected) : false,
    note: input.note ?? null,
    permissionsSnapshot: target.permissions,
    trustedById: input.actorId,
  };
  const trust = await db.trustedIntegration.upsert({
    where,
    create: { guildId: input.guildId, kind: input.kind, targetId: input.targetId, ...data },
    update: data,
  });
  await recordEvent(db, input.guildId, {
    type: "TRUST_GRANTED",
    source: "DASHBOARD",
    actorId: input.actorId,
    actorName: input.actorName,
    targetType: input.kind,
    targetId: input.targetId,
    targetName: target.name,
    summary: `${target.name} marked as trusted${data.protected ? " and protected" : ""}`,
    details: { protected: data.protected },
  });
  return { trust };
}

export async function getTrustMap(db: Db, guildId: string, kind: IntegrationKind) {
  const rows = await db.trustedIntegration.findMany({ where: { guildId, kind } });
  return new Map(rows.map((r) => [r.targetId, r]));
}

export async function addNote(
  db: Db,
  input: { guildId: string; kind: IntegrationKind; targetId: string; body: string; authorId: string; authorName: string | null },
) {
  const target = await targetExists(db, input.guildId, input.kind, input.targetId);
  if (!target) return { error: "NOT_FOUND" as const };
  const note = await db.integrationNote.create({
    data: { guildId: input.guildId, kind: input.kind, targetId: input.targetId, body: input.body, authorId: input.authorId },
  });
  await recordEvent(db, input.guildId, {
    type: "NOTE_ADDED",
    source: "DASHBOARD",
    actorId: input.authorId,
    actorName: input.authorName,
    targetType: input.kind,
    targetId: input.targetId,
    targetName: target.name,
    summary: `Note added to ${target.name}`,
  });
  return { note };
}

export async function listNotes(db: Db, guildId: string, kind: IntegrationKind, targetId: string) {
  return db.integrationNote.findMany({ where: { guildId, kind, targetId }, orderBy: { createdAt: "desc" }, take: 100 });
}
