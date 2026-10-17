import { has, Permission, toBits } from "@integris/security/permissions";
import type { Guild, GuildAccess } from "@prisma/client";
import type { Db } from "../client";

/** How long a Discord-verified authorization decision is reused. */
export const ACCESS_TTL_MS = 2 * 60 * 1000;

/** A guild as returned by Discord's GET /users/@me/guilds (server-to-server, never from the browser). */
export interface DiscordUserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

/** Integris requires Manage Server (or Administrator / ownership) to view or change guild security data. */
export function canManageGuild(g: { owner: boolean; permissions: string }): boolean {
  if (g.owner) return true;
  const bits = toBits(g.permissions);
  return has(bits, Permission.Administrator) || has(bits, Permission.ManageGuild);
}

/**
 * Stores the authorization facts Discord reported for this user. Rows are only kept
 * for guilds Integris knows about; stale rows (left guild, lost permission) are removed.
 */
export async function syncUserGuildAccess(db: Db, userId: string, guilds: DiscordUserGuild[], now = new Date()): Promise<void> {
  const known = await db.guild.findMany({ where: { id: { in: guilds.map((g) => g.id) } }, select: { id: true } });
  const knownIds = new Set(known.map((k) => k.id));
  const relevant = guilds.filter((g) => knownIds.has(g.id));

  await db.guildAccess.deleteMany({ where: { userId, guildId: { notIn: relevant.map((g) => g.id) } } });
  for (const g of relevant) {
    const data = { permissions: g.permissions, isOwner: g.owner, canManage: canManageGuild(g), checkedAt: now };
    await db.guildAccess.upsert({
      where: { guildId_userId: { guildId: g.id, userId } },
      create: { guildId: g.id, userId, ...data },
      update: data,
    });
  }
}

export type GuildAccessDenial = "INVALID_GUILD" | "NOT_MEMBER" | "FORBIDDEN" | "NOT_INSTALLED";

export type GuildAccessResult =
  | { ok: true; guild: Guild; access: GuildAccess }
  | { ok: false; reason: GuildAccessDenial; guild?: Guild | null };

/**
 * The single authorization gate for every guild-scoped dashboard request.
 *
 * 1. The guild ID must be a well-formed snowflake.
 * 2. Membership and permissions come from Discord (via `fetchUserGuilds`, which the
 *    caller performs server-side with the user's OAuth token), cached for ACCESS_TTL_MS.
 * 3. The user must own the guild or hold Administrator / Manage Server.
 * 4. Integris must currently be installed in the guild.
 */
export async function authorizeGuildAccess(
  db: Db,
  input: {
    userId: string;
    guildId: string;
    fetchUserGuilds: () => Promise<DiscordUserGuild[]>;
    now?: Date;
    ttlMs?: number;
  },
): Promise<GuildAccessResult> {
  const { userId, guildId } = input;
  const now = input.now ?? new Date();
  const ttl = input.ttlMs ?? ACCESS_TTL_MS;
  if (!/^\d{15,21}$/.test(guildId)) return { ok: false, reason: "INVALID_GUILD" };

  const guild = await db.guild.findUnique({ where: { id: guildId } });
  let access = await db.guildAccess.findUnique({ where: { guildId_userId: { guildId, userId } } });

  if (!access || now.getTime() - access.checkedAt.getTime() > ttl) {
    const guilds = await input.fetchUserGuilds();
    await syncUserGuildAccess(db, userId, guilds, now);
    const entry = guilds.find((g) => g.id === guildId);
    if (!entry) return { ok: false, reason: "NOT_MEMBER", guild };
    if (!canManageGuild(entry)) return { ok: false, reason: "FORBIDDEN", guild };
    access = await db.guildAccess.findUnique({ where: { guildId_userId: { guildId, userId } } });
  }

  if (!guild || !guild.botPresent) return { ok: false, reason: "NOT_INSTALLED", guild };
  if (!access) return { ok: false, reason: "NOT_MEMBER", guild };
  if (!access.canManage) return { ok: false, reason: "FORBIDDEN", guild };
  return { ok: true, guild, access };
}
