/**
 * Discord permission arithmetic. Implements the documented algorithm:
 * https://discord.com/developers/docs/topics/permissions#permission-overwrites
 * Runtime-agnostic (no Node APIs) so the dashboard can render permission names.
 */

export const Permission = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  PrioritySpeaker: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  MentionEveryone: 1n << 17n,
  UseExternalEmojis: 1n << 18n,
  ViewGuildInsights: 1n << 19n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeNickname: 1n << 26n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageGuildExpressions: 1n << 30n,
  UseApplicationCommands: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  ManageThreads: 1n << 34n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  UseExternalStickers: 1n << 37n,
  SendMessagesInThreads: 1n << 38n,
  UseEmbeddedActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
  ViewCreatorMonetizationAnalytics: 1n << 41n,
  UseSoundboard: 1n << 42n,
  CreateGuildExpressions: 1n << 43n,
  CreateEvents: 1n << 44n,
  UseExternalSounds: 1n << 45n,
  SendVoiceMessages: 1n << 46n,
  SendPolls: 1n << 49n,
  UseExternalApps: 1n << 50n,
  PinMessages: 1n << 51n,
  BypassSlowmode: 1n << 52n,
} as const;

export type PermissionName = keyof typeof Permission;

export const ALL_PERMISSIONS = Object.values(Permission).reduce((acc, p) => acc | p, 0n);

export const PERMISSION_LABELS: Record<PermissionName, string> = {
  CreateInstantInvite: "Create Invite",
  KickMembers: "Kick Members",
  BanMembers: "Ban Members",
  Administrator: "Administrator",
  ManageChannels: "Manage Channels",
  ManageGuild: "Manage Server",
  AddReactions: "Add Reactions",
  ViewAuditLog: "View Audit Log",
  PrioritySpeaker: "Priority Speaker",
  Stream: "Video",
  ViewChannel: "View Channels",
  SendMessages: "Send Messages",
  SendTTSMessages: "Send TTS Messages",
  ManageMessages: "Manage Messages",
  EmbedLinks: "Embed Links",
  AttachFiles: "Attach Files",
  ReadMessageHistory: "Read Message History",
  MentionEveryone: "Mention @everyone, @here and All Roles",
  UseExternalEmojis: "Use External Emojis",
  ViewGuildInsights: "View Server Insights",
  Connect: "Connect",
  Speak: "Speak",
  MuteMembers: "Mute Members",
  DeafenMembers: "Deafen Members",
  MoveMembers: "Move Members",
  UseVAD: "Use Voice Activity",
  ChangeNickname: "Change Nickname",
  ManageNicknames: "Manage Nicknames",
  ManageRoles: "Manage Roles",
  ManageWebhooks: "Manage Webhooks",
  ManageGuildExpressions: "Manage Expressions",
  UseApplicationCommands: "Use Application Commands",
  RequestToSpeak: "Request to Speak",
  ManageEvents: "Manage Events",
  ManageThreads: "Manage Threads",
  CreatePublicThreads: "Create Public Threads",
  CreatePrivateThreads: "Create Private Threads",
  UseExternalStickers: "Use External Stickers",
  SendMessagesInThreads: "Send Messages in Threads",
  UseEmbeddedActivities: "Use Activities",
  ModerateMembers: "Timeout Members",
  ViewCreatorMonetizationAnalytics: "View Creator Monetization Analytics",
  UseSoundboard: "Use Soundboard",
  CreateGuildExpressions: "Create Expressions",
  CreateEvents: "Create Events",
  UseExternalSounds: "Use External Sounds",
  SendVoiceMessages: "Send Voice Messages",
  SendPolls: "Create Polls",
  UseExternalApps: "Use External Apps",
  PinMessages: "Pin Messages",
  BypassSlowmode: "Bypass Slowmode",
};

export function toBits(value: bigint | string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return 0n;
  return typeof value === "bigint" ? value : BigInt(value);
}

export function has(bits: bigint, flag: bigint): boolean {
  return (bits & flag) === flag;
}

export function permissionNames(bits: bigint | string): PermissionName[] {
  const b = toBits(bits);
  return (Object.keys(Permission) as PermissionName[]).filter((k) => has(b, Permission[k]));
}

export function permissionLabels(bits: bigint | string): string[] {
  return permissionNames(bits).map((n) => PERMISSION_LABELS[n]);
}

export interface RoleInfo {
  id: string;
  name: string;
  position: number;
  permissions: bigint | string;
  managed: boolean;
  /** For managed bot roles: the bot user the role belongs to. */
  botId?: string | null;
}

export interface OverwriteInfo {
  id: string;
  /** 0 = role, 1 = member */
  type: 0 | 1;
  allow: bigint | string;
  deny: bigint | string;
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: number;
  parentId?: string | null;
  permissionOverwrites: OverwriteInfo[];
}

export interface GuildContext {
  guildId: string;
  ownerId: string | null;
  roles: RoleInfo[];
  channels: ChannelInfo[];
}

/** Guild-level permissions: @everyone OR every role the member holds. */
export function computeBasePermissions(ctx: GuildContext, memberId: string, memberRoleIds: readonly string[]): bigint {
  if (ctx.ownerId && ctx.ownerId === memberId) return ALL_PERMISSIONS;
  const everyone = ctx.roles.find((r) => r.id === ctx.guildId);
  let perms = toBits(everyone?.permissions);
  const held = new Set(memberRoleIds);
  for (const role of ctx.roles) {
    if (held.has(role.id)) perms |= toBits(role.permissions);
  }
  return has(perms, Permission.Administrator) ? ALL_PERMISSIONS : perms;
}

/** Applies a channel's overwrites to base permissions, in Discord's documented order. */
export function computeChannelPermissions(
  ctx: GuildContext,
  base: bigint,
  channel: ChannelInfo,
  memberId: string,
  memberRoleIds: readonly string[],
): bigint {
  if (has(base, Permission.Administrator)) return ALL_PERMISSIONS;
  let perms = base;
  const overwrites = channel.permissionOverwrites;

  const everyone = overwrites.find((o) => o.type === 0 && o.id === ctx.guildId);
  if (everyone) {
    perms &= ~toBits(everyone.deny);
    perms |= toBits(everyone.allow);
  }

  const held = new Set(memberRoleIds);
  let allow = 0n;
  let deny = 0n;
  for (const o of overwrites) {
    if (o.type === 0 && o.id !== ctx.guildId && held.has(o.id)) {
      allow |= toBits(o.allow);
      deny |= toBits(o.deny);
    }
  }
  perms &= ~deny;
  perms |= allow;

  const member = overwrites.find((o) => o.type === 1 && o.id === memberId);
  if (member) {
    perms &= ~toBits(member.deny);
    perms |= toBits(member.allow);
  }

  // Without View Channel every other channel permission is moot.
  if (!has(perms, Permission.ViewChannel)) return 0n;
  return perms;
}

export function highestRole(ctx: GuildContext, roleIds: readonly string[]): RoleInfo | null {
  const held = new Set(roleIds);
  let best: RoleInfo | null = null;
  for (const role of ctx.roles) {
    if (!held.has(role.id) || role.id === ctx.guildId) continue;
    // Discord breaks position ties by ID (lower ID = higher).
    if (!best || role.position > best.position || (role.position === best.position && BigInt(role.id) < BigInt(best.id))) {
      best = role;
    }
  }
  return best;
}

/** Roles (from `roleIds`) that contribute a given permission. */
export function rolesGranting(ctx: GuildContext, roleIds: readonly string[], flag: bigint): RoleInfo[] {
  const held = new Set([...roleIds, ctx.guildId]);
  return ctx.roles.filter((r) => held.has(r.id) && has(toBits(r.permissions), flag));
}

export interface PermissionDiff {
  gained: PermissionName[];
  lost: PermissionName[];
}

export function diffPermissions(before: bigint | string, after: bigint | string): PermissionDiff {
  const b = toBits(before);
  const a = toBits(after);
  return { gained: permissionNames(a & ~b), lost: permissionNames(b & ~a) };
}
