import { cookies, headers } from "next/headers";
import { generateToken } from "@integris/database/crypto";
import { authorizeUrl } from "@/lib/discord-oauth";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/redirects";
import { STATE_COOKIE } from "@/lib/session";

export async function GET(request: Request) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`login:${ip}`, 20, 60, true);
  if (!rl.allowed) return new Response("Too many sign-in attempts. Try again in a minute.", { status: 429 });

  const url = new URL(request.url);
  const state = generateToken(24);
  const next = safeNext(url.searchParams.get("next"));
  (await cookies()).set(STATE_COOKIE(), `${state}|${next}`, {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return Response.redirect(authorizeUrl(state), 302);
}
