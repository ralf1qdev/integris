import { cookies, headers } from "next/headers";
import { safeEqual } from "@integris/database/crypto";
import { db } from "@/lib/db";
import { DiscordAuthError, exchangeCode, fetchIdentity, storeTokens } from "@/lib/discord-oauth";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { safeNext } from "@/lib/redirects";
import { createSession, STATE_COOKIE } from "@/lib/session";

function fail(reason: string) {
  return Response.redirect(`${env().APP_URL}/login?error=${encodeURIComponent(reason)}`, 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const stored = jar.get(STATE_COOKIE())?.value ?? "";
  jar.delete(STATE_COOKIE());

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "denied" : "oauth");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const [expectedState, next = "/dashboard"] = stored.split("|");
  // State binds the callback to the browser that started the flow (login CSRF protection).
  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) return fail("state");

  try {
    const tokens = await exchangeCode(code);
    const scopes = tokens.scope.split(" ");
    if (!scopes.includes("identify") || !scopes.includes("guilds")) return fail("scope");
    const me = await fetchIdentity(tokens.access_token);
    await db.user.upsert({
      where: { id: me.id },
      create: { id: me.id, username: me.username, globalName: me.global_name, avatar: me.avatar },
      update: { username: me.username, globalName: me.global_name, avatar: me.avatar },
    });
    await storeTokens(me.id, tokens);
    await createSession(me.id, (await headers()).get("user-agent"));
    log.info({ userId: me.id }, "user signed in");
    return Response.redirect(`${env().APP_URL}${safeNext(next)}`, 302);
  } catch (err) {
    log.warn({ err }, "oauth callback failed");
    return fail(err instanceof DiscordAuthError ? "expired" : "oauth");
  }
}
