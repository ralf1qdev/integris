import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { z } from "zod";
import { authorizeGuildAccess, type Guild, type GuildAccess, type GuildAccessDenial } from "@integris/database";
import { db } from "./db";
import { DiscordAuthError, fetchUserGuilds } from "./discord-oauth";
import { log } from "./log";
import { rateLimit } from "./rate-limit";
import { getSession, verifyCsrf, type CurrentSession } from "./session";

export async function requireUser(next = "/dashboard"): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

export type GuildGateDenial = GuildAccessDenial | "UNAUTHENTICATED" | "REAUTH" | "UNAVAILABLE";
export type GuildGate =
  | { ok: true; session: CurrentSession; guild: Guild; access: GuildAccess }
  | { ok: false; reason: GuildGateDenial; guild?: Guild | null };

/**
 * Server-side authorization for one guild, memoised per request. Membership and
 * permissions are verified with Discord — nothing from the browser is trusted.
 */
export const checkGuildAccess = cache(async (guildId: string): Promise<GuildGate> => {
  const session = await getSession();
  if (!session) return { ok: false, reason: "UNAUTHENTICATED" };
  try {
    const r = await authorizeGuildAccess(db, { userId: session.user.id, guildId, fetchUserGuilds: () => fetchUserGuilds(session.user.id) });
    return r.ok ? { ok: true, session, guild: r.guild, access: r.access } : r;
  } catch (err) {
    if (err instanceof DiscordAuthError) return { ok: false, reason: "REAUTH" };
    log.error({ err, guildId }, "guild authorization failed");
    return { ok: false, reason: "UNAVAILABLE" };
  }
});

// ───────────── API helpers ─────────────

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function apiError(status: number, code: string, message: string, headers: Record<string, string> = {}) {
  return json({ error: { code, message } }, status, headers);
}

const DENIAL: Record<GuildGateDenial, [number, string]> = {
  UNAUTHENTICATED: [401, "Sign in to continue."],
  REAUTH: [401, "Your Discord session expired. Sign in again."],
  INVALID_GUILD: [400, "Invalid server ID."],
  // Not distinguishing "not a member" from "does not exist" avoids leaking which guilds use Integris.
  NOT_MEMBER: [404, "Server not found."],
  FORBIDDEN: [403, "You need the Manage Server permission in this server."],
  NOT_INSTALLED: [409, "Integris is not installed in this server."],
  UNAVAILABLE: [503, "Authorization could not be verified with Discord. Try again shortly."],
};

const MAX_BODY_BYTES = 16 * 1024;

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<{ data: z.infer<S> } | { response: Response }> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return { response: apiError(413, "payload_too_large", "Request body too large.") };
  if (!req.headers.get("content-type")?.includes("application/json")) return { response: apiError(415, "unsupported_media_type", "Expected JSON.") };
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return { response: apiError(413, "payload_too_large", "Request body too large.") };
    raw = JSON.parse(text);
  } catch {
    return { response: apiError(400, "invalid_json", "Malformed JSON.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: json(
        { error: { code: "validation_failed", message: "Some fields are invalid.", fields: parsed.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message })) } },
        422,
      ),
    };
  }
  return { data: parsed.data };
}

export interface GuildRouteContext<P> {
  params: P;
  session: CurrentSession;
  guild: Guild;
  access: GuildAccess;
}

interface GuildRouteOptions {
  /** State-changing route: requires CSRF verification and fails closed on rate-limiter errors. */
  mutation?: boolean;
  limit?: { bucket: string; max: number; windowSeconds: number };
}

/**
 * Wraps every guild-scoped API route: session → CSRF → rate limit → Discord-verified
 * guild authorization → handler. Handlers receive only an authorised guild.
 */
export function guildRoute<P extends { guildId: string }>(
  opts: GuildRouteOptions,
  handler: (req: Request, ctx: GuildRouteContext<P>) => Promise<Response>,
) {
  return async (req: Request, segment: { params: Promise<P> }): Promise<Response> => {
    const params = await segment.params;
    const session = await getSession();
    if (!session) return apiError(401, "unauthenticated", DENIAL.UNAUTHENTICATED[1]);
    if (opts.mutation && !verifyCsrf(req, session.token)) return apiError(403, "csrf_failed", "Request verification failed. Reload the page and try again.");

    const limit = opts.limit ?? (opts.mutation ? { bucket: "write", max: 30, windowSeconds: 60 } : { bucket: "read", max: 120, windowSeconds: 60 });
    const rl = await rateLimit(`${session.user.id}:${limit.bucket}`, limit.max, limit.windowSeconds, !opts.mutation);
    if (!rl.allowed) return apiError(429, "rate_limited", "Too many requests. Slow down and try again.", { "Retry-After": String(rl.retryAfterSeconds) });

    const gate = await checkGuildAccess(params.guildId);
    if (!gate.ok) {
      const [status, message] = DENIAL[gate.reason];
      return apiError(status, gate.reason.toLowerCase(), message);
    }
    try {
      return await handler(req, { params, session: gate.session, guild: gate.guild, access: gate.access });
    } catch (err) {
      log.error({ err, guildId: params.guildId, path: new URL(req.url).pathname }, "api handler failed");
      return apiError(500, "internal_error", "Something went wrong. The error has been logged.");
    }
  };
}

export const actorName = (s: CurrentSession) => s.user.globalName ?? s.user.username;
