import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { generateToken, hashToken, safeEqual } from "@integris/database/crypto";
import { db } from "./db";
import { env } from "./env";

export const SESSION_TTL_MS = 7 * 24 * 3600_000;
const TOUCH_INTERVAL_MS = 5 * 60_000;

const secure = () => env().APP_URL.startsWith("https://");
// The __Host- prefix pins cookies to this exact origin over HTTPS (no Domain, Path=/).
export const cookieName = (base: string) => (secure() ? `__Host-${base}` : base);
export const SESSION_COOKIE = () => cookieName("integris_session");
export const CSRF_COOKIE = () => cookieName("integris_csrf");
export const STATE_COOKIE = () => cookieName("integris_oauth");

export function csrfTokenFor(sessionToken: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(`csrf:${sessionToken}`).digest("base64url");
}

export async function createSession(userId: string, userAgent: string | null) {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null } });
  const jar = await cookies();
  const base = { secure: secure(), path: "/", expires: expiresAt };
  jar.set(SESSION_COOKIE(), token, { ...base, httpOnly: true, sameSite: "lax" });
  // Readable by the dashboard's JS so it can echo it in the X-Integris-CSRF header.
  jar.set(CSRF_COOKIE(), csrfTokenFor(token), { ...base, httpOnly: false, sameSite: "strict" });
}

export interface CurrentSession {
  token: string;
  sessionId: string;
  user: { id: string; username: string; globalName: string | null; avatar: string | null };
}

/** Resolves the session from the cookie. Memoised per request. */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE())?.value;
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  const { id, username, globalName, avatar } = session.user;
  return { token, sessionId: session.id, user: { id, username, globalName, avatar } };
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE())?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE());
  jar.delete(CSRF_COOKIE());
}

/**
 * CSRF defence for state-changing requests:
 *  1. Origin (or Referer) must be the dashboard's own origin.
 *  2. X-Integris-CSRF must equal HMAC(session token) — unforgeable cross-site.
 * SameSite cookies are a third, independent layer.
 */
export function verifyCsrf(request: Request, sessionToken: string): boolean {
  const expectedOrigin = new URL(env().APP_URL).origin;
  const origin = request.headers.get("origin") ?? (request.headers.get("referer") ? new URL(request.headers.get("referer")!).origin : null);
  if (origin !== expectedOrigin) return false;
  const header = request.headers.get("x-integris-csrf");
  return Boolean(header) && safeEqual(header!, csrfTokenFor(sessionToken));
}
