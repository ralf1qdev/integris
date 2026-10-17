import { buildBotInviteUrl } from "@integris/shared";
import { env } from "@/lib/env";

/** Redirects to Discord's bot authorization screen with Integris' least-privilege permissions. */
export function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guild_id");
  const valid = guildId && /^\d{15,21}$/.test(guildId) ? guildId : undefined;
  return Response.redirect(buildBotInviteUrl(env().DISCORD_CLIENT_ID, valid), 302);
}
