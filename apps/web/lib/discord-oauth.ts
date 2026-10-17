import "server-only";
import { decryptSecret, encryptSecret } from "@integris/database/crypto";
import type { DiscordUserGuild } from "@integris/database";
import { DISCORD_API } from "@integris/shared";
import { db } from "./db";
import { env } from "./env";
import { log } from "./log";
import { redis } from "./redis";

/** Minimal scopes: identity and the guild list (with the user's permissions). */
export const OAUTH_SCOPES = ["identify", "guilds"] as const;

export class DiscordAuthError extends Error {}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface DiscordIdentity {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export function authorizeUrl(state: string): string {
  const e = env();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: e.DISCORD_CLIENT_ID,
    scope: OAUTH_SCOPES.join(" "),
    redirect_uri: e.DISCORD_REDIRECT_URI,
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const e = env();
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${e.DISCORD_CLIENT_ID}:${e.DISCORD_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (res.status === 400 || res.status === 401) throw new DiscordAuthError(`token request rejected (${res.status})`);
  if (!res.ok) throw new Error(`Discord token endpoint returned ${res.status}`);
  return (await res.json()) as TokenSet;
}

export function exchangeCode(code: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: env().DISCORD_REDIRECT_URI });
}

export async function revokeToken(token: string) {
  const e = env();
  await fetch(`${DISCORD_API}/oauth2/token/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${e.DISCORD_CLIENT_ID}:${e.DISCORD_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ token, token_type_hint: "access_token" }),
  }).catch(() => {});
}

/** User-token GET with a single honoured retry on 429. */
async function userGet<T>(path: string, accessToken: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${DISCORD_API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (res.status === 429 && attempt === 0) {
      const retry = Number(res.headers.get("retry-after") ?? "1");
      await new Promise((r) => setTimeout(r, Math.min(Math.max(retry, 0.2), 5) * 1000));
      continue;
    }
    if (res.status === 401) throw new DiscordAuthError("access token rejected");
    if (!res.ok) throw new Error(`Discord ${path} returned ${res.status}`);
    return (await res.json()) as T;
  }
  throw new Error(`Discord ${path} rate limited`);
}

export const fetchIdentity = (accessToken: string) => userGet<DiscordIdentity>("/users/@me", accessToken);

export async function storeTokens(userId: string, t: TokenSet) {
  const key = env().ENCRYPTION_KEY;
  const data = {
    accessTokenEnc: encryptSecret(t.access_token, key, `access:${userId}`),
    refreshTokenEnc: encryptSecret(t.refresh_token, key, `refresh:${userId}`),
    accessTokenExpiry: new Date(Date.now() + t.expires_in * 1000),
    scope: t.scope,
  };
  await db.account.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

/** Returns a valid access token, refreshing it when it is about to expire. */
export async function getAccessToken(userId: string): Promise<string> {
  const account = await db.account.findUnique({ where: { userId } });
  if (!account) throw new DiscordAuthError("no linked account");
  const key = env().ENCRYPTION_KEY;
  if (account.accessTokenExpiry.getTime() - Date.now() > 60_000) {
    return decryptSecret(account.accessTokenEnc, key, `access:${userId}`);
  }
  const refreshed = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptSecret(account.refreshTokenEnc, key, `refresh:${userId}`) });
  await storeTokens(userId, refreshed);
  return refreshed.access_token;
}

const GUILD_CACHE_SECONDS = 60;

/**
 * The user's guilds as reported by Discord, fetched server-side with the user's
 * token. Cached briefly because Discord rate-limits this endpoint heavily.
 */
export async function fetchUserGuilds(userId: string, opts: { fresh?: boolean } = {}): Promise<DiscordUserGuild[]> {
  const cacheKey = `integris:user-guilds:${userId}`;
  if (!opts.fresh) {
    const hit = await redis().get(cacheKey).catch(() => null);
    if (hit) return JSON.parse(hit) as DiscordUserGuild[];
  }
  const token = await getAccessToken(userId);
  const raw = await userGet<Array<DiscordUserGuild & Record<string, unknown>>>("/users/@me/guilds", token);
  const guilds = raw.map((g) => ({ id: g.id, name: g.name, icon: g.icon ?? null, owner: Boolean(g.owner), permissions: String(g.permissions) }));
  await redis().set(cacheKey, JSON.stringify(guilds), "EX", GUILD_CACHE_SECONDS).catch((err) => log.warn({ err }, "guild cache write failed"));
  return guilds;
}
