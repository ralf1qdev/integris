import { buildBotInviteUrl } from "@integris/shared";
import { KeyRound, LogIn, PlugZap, ServerCrash, ShieldX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { GuildGateDenial } from "@/lib/auth";

const COPY: Record<GuildGateDenial, { icon: typeof ShieldX; title: string; body: string }> = {
  UNAUTHENTICATED: { icon: LogIn, title: "Sign in to continue", body: "Your session has ended. Sign in with Discord to view this server." },
  REAUTH: { icon: LogIn, title: "Reconnect your Discord account", body: "Discord no longer accepts Integris' access for your account. Sign in again to continue." },
  INVALID_GUILD: { icon: ShieldX, title: "Server not found", body: "That server ID is not valid." },
  NOT_MEMBER: { icon: ShieldX, title: "Server not found", body: "You are not a member of this server, or Discord did not report it for your account. If you joined recently, wait a minute and try again." },
  FORBIDDEN: {
    icon: KeyRound,
    title: "Manage Server permission required",
    body: "Integris only shows security data to the server owner and members with Administrator or Manage Server. Ask the server owner to grant one of these through Server Settings → Roles, then reload this page.",
  },
  NOT_INSTALLED: { icon: PlugZap, title: "Integris is not in this server yet", body: "Add Integris to start monitoring bots and webhooks. Once it joins, an initial scan runs automatically." },
  UNAVAILABLE: { icon: ServerCrash, title: "Could not verify access", body: "Integris could not reach Discord to confirm your permissions. Nothing is wrong with your server — try again in a moment." },
};

export function AccessDenied({ reason, guildId, clientId }: { reason: GuildGateDenial; guildId: string; clientId: string }) {
  const c = COPY[reason];
  const Icon = c.icon;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <div className="mb-5 grid size-12 place-items-center rounded-xl border border-border bg-surface">
        <Icon className="size-5 text-secondary" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight">{c.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
      <div className="mt-6 flex gap-2">
        {reason === "NOT_INSTALLED" ? (
          <Button asChild>
            <a href={buildBotInviteUrl(clientId, guildId)}>Add Integris to server</a>
          </Button>
        ) : null}
        {reason === "UNAUTHENTICATED" || reason === "REAUTH" ? (
          <Button asChild>
            <a href={`/api/auth/login?next=/dashboard/${guildId}`}>Sign in with Discord</a>
          </Button>
        ) : null}
        <Button variant="secondary" asChild>
          <Link href="/dashboard">All servers</Link>
        </Button>
      </div>
    </div>
  );
}
