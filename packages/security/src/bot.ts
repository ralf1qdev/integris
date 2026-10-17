import { maxSeverity, type RiskLevel, type Severity } from "@integris/shared";
import { CHANNEL_SENSITIVE, DANGEROUS_PERMISSIONS, label } from "./dangerous";
import {
  computeBasePermissions,
  computeChannelPermissions,
  has,
  highestRole,
  Permission,
  rolesGranting,
  toBits,
  type GuildContext,
  type PermissionName,
  type RoleInfo,
} from "./permissions";
import type { FindingDraft } from "./types";

export interface BotMember {
  userId: string;
  username: string;
  roleIds: string[];
  /** From the user's public flags. null when Discord did not report flags. */
  verified: boolean | null;
}

export interface ChannelElevation {
  channelId: string;
  channelName: string;
  gained: PermissionName[];
}

export interface BotEvaluation {
  permissions: bigint;
  isAdministrator: boolean;
  highestRole: Pick<RoleInfo, "id" | "name" | "position"> | null;
  channelElevations: ChannelElevation[];
  findings: FindingDraft[];
  riskLevel: RiskLevel;
}

const VERIFIED_TEXT = (v: boolean | null) => (v === null ? "Unknown" : v ? "Yes" : "No");

export function riskLevelFrom(severity: Severity | null): RiskLevel {
  if (!severity || severity === "INFO") return "NONE";
  return severity;
}

/**
 * Evaluates one bot account against the guild's roles and channels.
 * Pure and deterministic: the same inputs always produce the same findings.
 */
export function evaluateBot(ctx: GuildContext, bot: BotMember): BotEvaluation {
  const base = computeBasePermissions(ctx, bot.userId, bot.roleIds);
  const isAdmin = has(base, Permission.Administrator);
  const top = highestRole(ctx, bot.roleIds);
  const findings: FindingDraft[] = [];
  const target = { targetType: "BOT" as const, targetId: bot.userId, targetName: bot.username };
  const grantedBy = (flag: bigint) => rolesGranting(ctx, bot.roleIds, flag).map((r) => r.name);

  if (isAdmin) {
    const critical = bot.verified === false;
    findings.push({
      ...target,
      ruleId: "bot.administrator",
      severity: critical ? "CRITICAL" : "HIGH",
      title: "Bot has Administrator",
      description: `${bot.username} holds Administrator. ${DANGEROUS_PERMISSIONS[0]!.impact}${
        critical ? " The bot is not verified by Discord." : ""
      }`,
      recommendation:
        "Most bots do not need Administrator. Replace it with the specific permissions the bot documents, or mark the bot as trusted if this is intentional.",
      evidence: { grantedBy: grantedBy(Permission.Administrator), verifiedBot: VERIFIED_TEXT(bot.verified) },
    });
  } else {
    for (const d of DANGEROUS_PERMISSIONS) {
      if (d.name === "Administrator" || !has(base, d.flag)) continue;
      findings.push({
        ...target,
        ruleId: `bot.permission.${d.name}`,
        severity: d.severity,
        title: `Bot can ${label(d.name)}`,
        description: `${bot.username} has ${label(d.name)}. ${d.impact}`,
        recommendation: `Confirm ${bot.username} needs ${label(d.name)}. If not, remove it from the roles that grant it.`,
        evidence: { permission: label(d.name), grantedBy: grantedBy(d.flag) },
      });
    }

    // Role hierarchy: Manage Roles lets a bot assign any role positioned below its highest role.
    if (has(base, Permission.ManageRoles) && top) {
      const reachable = ctx.roles.filter(
        (r) =>
          r.id !== ctx.guildId &&
          !r.managed &&
          (r.position < top.position || (r.position === top.position && BigInt(r.id) > BigInt(top.id))) &&
          DANGEROUS_PERMISSIONS.some((d) => has(toBits(r.permissions), d.flag) && !has(base, d.flag)),
      );
      if (reachable.length) {
        const adminRoles = reachable.filter((r) => has(toBits(r.permissions), Permission.Administrator));
        findings.push({
          ...target,
          ruleId: "bot.role-hierarchy",
          severity: adminRoles.length ? "HIGH" : "MEDIUM",
          title: "Bot can assign more powerful roles",
          description: `${bot.username} has Manage Roles and sits above ${reachable.length} role(s) carrying permissions it does not hold itself${
            adminRoles.length ? ", including Administrator" : ""
          }. It could assign those roles to accounts it controls.`,
          recommendation:
            "Move the bot's role below roles with elevated permissions in Server Settings → Roles, or remove Manage Roles if it is not required.",
          evidence: {
            highestRole: top.name,
            assignableRoles: reachable.slice(0, 10).map((r) => r.name),
            includesAdministrator: adminRoles.length > 0,
          },
        });
      }
    }

    if (bot.verified === false && findings.some((f) => f.severity === "MEDIUM" || f.severity === "HIGH")) {
      findings.push({
        ...target,
        ruleId: "bot.unverified-privileged",
        severity: "MEDIUM",
        title: "Unverified bot with elevated permissions",
        description: `${bot.username} is not verified by Discord and holds elevated permissions. Unverified bots are common for small or private bots; this is a prompt to confirm who operates it.`,
        recommendation: "Confirm you know who operates this bot. Mark it as trusted once reviewed.",
        evidence: { verifiedBot: "No" },
      });
    }
  }

  // Channel overwrites that grant sensitive permissions beyond the guild-level baseline.
  const elevations: ChannelElevation[] = [];
  if (!isAdmin) {
    for (const channel of ctx.channels) {
      const perms = computeChannelPermissions(ctx, base, channel, bot.userId, bot.roleIds);
      const gained = CHANNEL_SENSITIVE.filter((c) => has(perms, Permission[c.name]) && !has(base, Permission[c.name])).map(
        (c) => c.name,
      );
      if (gained.length) elevations.push({ channelId: channel.id, channelName: channel.name, gained });
    }
    if (elevations.length) {
      const names = new Set(elevations.flatMap((e) => e.gained));
      const severity = maxSeverity(CHANNEL_SENSITIVE.filter((c) => names.has(c.name)).map((c) => c.severity)) ?? "LOW";
      findings.push({
        ...target,
        ruleId: "bot.channel-overwrite",
        severity,
        title: "Channel overwrites grant extra permissions",
        description: `Permission overwrites in ${elevations.length} channel(s) give ${bot.username} permissions it does not have server-wide.`,
        recommendation: "Review the channel permission overwrites listed in the evidence and remove any the bot does not need.",
        evidence: {
          channels: elevations.slice(0, 10).map((e) => `#${e.channelName}: ${e.gained.map(label).join(", ")}`),
          totalChannels: elevations.length,
        },
      });
    }
  }

  return {
    permissions: base,
    isAdministrator: isAdmin,
    highestRole: top ? { id: top.id, name: top.name, position: top.position } : null,
    channelElevations: elevations,
    findings,
    riskLevel: riskLevelFrom(maxSeverity(findings.map((f) => f.severity))),
  };
}
