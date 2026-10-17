import type { Db } from "../client";

export async function listBots(db: Db, guildId: string, opts: { includeRemoved?: boolean } = {}) {
  return db.botInventory.findMany({
    where: { guildId, ...(opts.includeRemoved ? {} : { isPresent: true }) },
    orderBy: [{ isPresent: "desc" }, { username: "asc" }],
  });
}

export async function getBot(db: Db, guildId: string, botUserId: string) {
  return db.botInventory.findUnique({ where: { guildId_botUserId: { guildId, botUserId } } });
}

export async function listWebhooks(db: Db, guildId: string, opts: { includeDeleted?: boolean } = {}) {
  return db.webhookInventory.findMany({
    where: { guildId, ...(opts.includeDeleted ? {} : { status: "ACTIVE" }) },
    orderBy: [{ status: "asc" }, { channelName: "asc" }, { name: "asc" }],
  });
}

export async function getWebhook(db: Db, guildId: string, webhookId: string) {
  return db.webhookInventory.findUnique({ where: { guildId_webhookId: { guildId, webhookId } } });
}

export async function listChannels(db: Db, guildId: string) {
  return db.guildChannel.findMany({ where: { guildId }, orderBy: [{ position: "asc" }, { name: "asc" }] });
}

export async function listRoles(db: Db, guildId: string) {
  return db.guildRole.findMany({ where: { guildId }, orderBy: { position: "desc" } });
}
