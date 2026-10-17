import type { Severity } from "@integris/shared";
import { Permission, PERMISSION_LABELS, type PermissionName } from "./permissions";

/**
 * Capabilities Integris treats as security-relevant, with the severity used when
 * an *untrusted* bot holds them at guild level. Severities describe potential
 * impact if the bot or its owner's credentials were compromised — they are not a
 * judgement that a bot is malicious.
 */
export interface DangerousPermission {
  name: PermissionName;
  flag: bigint;
  severity: Severity;
  impact: string;
}

export const DANGEROUS_PERMISSIONS: readonly DangerousPermission[] = [
  {
    name: "Administrator",
    flag: Permission.Administrator,
    severity: "HIGH",
    impact: "Bypasses every permission and channel overwrite. It can change any setting, role, channel or webhook and read every channel.",
  },
  {
    name: "ManageGuild",
    flag: Permission.ManageGuild,
    severity: "MEDIUM",
    impact: "Can change server settings and authorize additional bots into the server.",
  },
  {
    name: "ManageRoles",
    flag: Permission.ManageRoles,
    severity: "MEDIUM",
    impact: "Can edit roles below its highest role and assign those roles to members.",
  },
  {
    name: "ManageWebhooks",
    flag: Permission.ManageWebhooks,
    severity: "MEDIUM",
    impact: "Can create webhooks that post under any name and avatar, and can read the tokens of existing webhooks.",
  },
  {
    name: "ManageChannels",
    flag: Permission.ManageChannels,
    severity: "MEDIUM",
    impact: "Can create, delete and re-permission channels.",
  },
  {
    name: "BanMembers",
    flag: Permission.BanMembers,
    severity: "MEDIUM",
    impact: "Can ban members below its highest role.",
  },
  {
    name: "KickMembers",
    flag: Permission.KickMembers,
    severity: "LOW",
    impact: "Can remove members below its highest role.",
  },
  {
    name: "MentionEveryone",
    flag: Permission.MentionEveryone,
    severity: "LOW",
    impact: "Can ping @everyone, @here and every role, which is commonly abused for spam or phishing.",
  },
  {
    name: "ModerateMembers",
    flag: Permission.ModerateMembers,
    severity: "LOW",
    impact: "Can time out members below its highest role.",
  },
];

export const DANGEROUS_BY_NAME = new Map(DANGEROUS_PERMISSIONS.map((d) => [d.name, d]));

/** Channel-level permissions worth reporting when an overwrite grants them beyond the guild-level baseline. */
export const CHANNEL_SENSITIVE: readonly { name: PermissionName; severity: Severity }[] = [
  { name: "ManageWebhooks", severity: "MEDIUM" },
  { name: "ManageRoles", severity: "MEDIUM" }, // shown as "Manage Permissions" on channels
  { name: "ManageChannels", severity: "LOW" },
  { name: "MentionEveryone", severity: "LOW" },
  { name: "ManageMessages", severity: "LOW" },
];

export function label(name: PermissionName): string {
  return PERMISSION_LABELS[name];
}
