import { createScanJob, markGuildRemoved, recordEvent, upsertGuildFromGateway } from "@integris/database";
import type { Client, Guild } from "discord.js";
import { db, enqueueScan, log } from "../runtime";

async function register(guild: Guild, reason: string) {
  const { reinstalled } = await upsertGuildFromGateway(db, { id: guild.id, name: guild.name, icon: guild.icon, ownerId: guild.ownerId });
  const stored = await db.guild.findUniqueOrThrow({ where: { id: guild.id } });
  if (reinstalled) {
    await recordEvent(db, guild.id, {
      type: "INTEGRIS_INSTALLED",
      source: "GATEWAY",
      targetType: "GUILD",
      targetId: guild.id,
      targetName: guild.name,
      summary: "Integris was added to the server",
      dedupKey: `installed:${stored.installedAt?.getTime() ?? Date.now()}`,
    });
  }
  const stale = stored.lastSyncAt && Date.now() - stored.lastSyncAt.getTime() > 30 * 60_000;
  if (reinstalled || !stored.lastSyncAt || (reason === "ready" && stale)) {
    // After downtime Gateway events may have been missed, so reconcile stale guilds.
    const trigger = reinstalled || !stored.lastSyncAt ? "INSTALL" : "EVENT";
    const scan = await createScanJob(db, { guildId: guild.id, trigger });
    if (scan.status === "created") await enqueueScan({ guildId: guild.id, scanJobId: scan.scan.id, trigger });
  }
  log.info({ guildId: guild.id, reason, reinstalled }, "guild registered");
}

export function registerGuildEvents(client: Client) {
  client.on("guildCreate", (guild) => void register(guild, "guildCreate").catch((err) => log.error({ err, guildId: guild.id }, "guildCreate failed")));

  client.on("guildDelete", async (guild) => {
    // An unavailable guild is a Discord outage, not a removal.
    if (!guild.available) return;
    try {
      await markGuildRemoved(db, guild.id);
      await recordEvent(db, guild.id, { type: "INTEGRIS_REMOVED", source: "GATEWAY", targetType: "GUILD", targetId: guild.id, summary: "Integris was removed from the server" }).catch(() => {});
      log.info({ guildId: guild.id }, "guild removed");
    } catch (err) {
      log.error({ err, guildId: guild.id }, "guildDelete failed");
    }
  });

  client.on("guildUpdate", async (_old, guild) => {
    await db.guild.updateMany({ where: { id: guild.id }, data: { name: guild.name, icon: guild.icon, ownerId: guild.ownerId } }).catch((err) => log.error({ err }, "guildUpdate failed"));
  });
}

/** On (re)connect, reconcile which guilds Integris is in — joins/leaves may have happened while offline. */
export async function reconcileGuildMembership(client: Client) {
  const current = new Set(client.guilds.cache.keys());
  for (const guild of client.guilds.cache.values()) {
    await register(guild, "ready").catch((err) => log.error({ err, guildId: guild.id }, "ready registration failed"));
  }
  const stale = await db.guild.findMany({ where: { botPresent: true, id: { notIn: [...current] } }, select: { id: true } });
  for (const { id } of stale) await markGuildRemoved(db, id);
  log.info({ guilds: current.size, removedWhileOffline: stale.length }, "guild membership reconciled");
}
