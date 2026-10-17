import { AuditLogAction } from "@integris/shared";
import type { Client, GuildChannel } from "discord.js";
import { forward } from "../runtime";

const now = () => new Date().toISOString();
const WATCHED_AUDIT_ACTIONS = new Set<number>(Object.values(AuditLogAction));

function overwritesKey(channel: GuildChannel): string {
  return JSON.stringify(
    [...channel.permissionOverwrites.cache.values()]
      .map((o) => [o.id, o.type, o.allow.bitfield.toString(), o.deny.bitfield.toString()])
      .sort(),
  );
}

/**
 * Gateway handlers. Each forwards a small normalised signal; the worker does the
 * REST lookups, diffing and rule evaluation. Discord does not emit an event for
 * every change, so periodic reconciliation scans remain the source of truth.
 */
export function registerMonitoringEvents(client: Client) {
  client.on("guildMemberAdd", (member) => {
    if (!member.user.bot) return;
    void forward({ type: "member.added", guildId: member.guild.id, userId: member.id, occurredAt: now() }, `${member.guild.id}-${member.id}-${member.joinedTimestamp ?? 0}`);
  });

  client.on("guildMemberRemove", (member) => {
    if (!member.user?.bot) return;
    void forward({ type: "member.removed", guildId: member.guild.id, userId: member.id, occurredAt: now() }, `${member.guild.id}-${member.id}`, 2_000);
  });

  client.on("guildMemberUpdate", (oldMember, member) => {
    if (!member.user.bot) return;
    const oldRoles = oldMember.partial ? null : [...oldMember.roles.cache.keys()].filter((id) => id !== member.guild.id).sort();
    const newRoles = [...member.roles.cache.keys()].filter((id) => id !== member.guild.id).sort();
    if (oldRoles && oldRoles.join() === newRoles.join()) return;
    void forward(
      { type: "member.updated", guildId: member.guild.id, userId: member.id, oldRoleIds: oldRoles, newRoleIds: newRoles, occurredAt: now() },
      `${member.guild.id}-${member.id}-${newRoles.join(".")}`,
      1_000,
    );
  });

  client.on("roleUpdate", (oldRole, role) => {
    if (oldRole.permissions.bitfield === role.permissions.bitfield && oldRole.name === role.name) return;
    void forward(
      {
        type: "role.updated",
        guildId: role.guild.id,
        roleId: role.id,
        name: role.name,
        oldPermissions: oldRole.permissions.bitfield.toString(),
        newPermissions: role.permissions.bitfield.toString(),
        occurredAt: now(),
      },
      `${role.id}-${role.permissions.bitfield}`,
    );
  });

  client.on("roleDelete", (role) => {
    void forward({ type: "role.deleted", guildId: role.guild.id, roleId: role.id, occurredAt: now() }, role.id);
  });

  client.on("channelUpdate", (oldChannel, channel) => {
    if (!("guild" in channel) || channel.isDMBased() || !("permissionOverwrites" in channel) || !("permissionOverwrites" in oldChannel)) return;
    if (overwritesKey(oldChannel as GuildChannel) === overwritesKey(channel as GuildChannel)) return;
    void forward({ type: "channel.permissions_changed", guildId: channel.guild.id, channelId: channel.id, occurredAt: now() }, `${channel.guild.id}`, 3_000);
  });

  client.on("channelDelete", (channel) => {
    if (channel.isDMBased()) return;
    void forward({ type: "channel.deleted", guildId: channel.guild.id, channelId: channel.id, occurredAt: now() }, channel.id);
  });

  client.on("webhooksUpdate", (channel) => {
    void forward({ type: "webhooks.updated", guildId: channel.guild.id, channelId: channel.id, occurredAt: now() }, channel.guild.id, 2_000);
  });

  client.on("guildIntegrationsUpdate", (guild) => {
    void forward({ type: "integrations.updated", guildId: guild.id, occurredAt: now() }, guild.id, 5_000);
  });

  client.on("guildAuditLogEntryCreate", (entry, guild) => {
    if (!WATCHED_AUDIT_ACTIONS.has(entry.action)) return;
    void forward(
      {
        type: "audit.entry",
        guildId: guild.id,
        entryId: entry.id,
        actionType: entry.action,
        executorId: entry.executorId,
        executorName: entry.executor ? (entry.executor.globalName ?? entry.executor.username) : null,
        targetId: entry.targetId,
        reason: entry.reason?.slice(0, 512) ?? null,
        occurredAt: entry.createdAt.toISOString(),
      },
      entry.id,
      // Give the related resource signal a head start so the actor can be attached to it.
      3_000,
    );
  });
}
