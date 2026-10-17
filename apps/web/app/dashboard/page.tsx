import { canManageGuild, syncUserGuildAccess } from "@integris/database";
import { buildBotInviteUrl, guildIconUrl } from "@integris/shared";
import { ArrowRight, Plus, ServerOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, initials } from "@/components/dashboard/avatar";
import { EmptyState } from "@/components/dashboard/empty-state";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DiscordAuthError, fetchUserGuilds } from "@/lib/discord-oauth";
import { env } from "@/lib/env";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Servers" };

export default async function ServersPage() {
  const session = await requireUser();
  let guilds;
  try {
    guilds = await fetchUserGuilds(session.user.id);
  } catch (err) {
    if (err instanceof DiscordAuthError) return <AccessDenied reason="REAUTH" guildId="" clientId={env().DISCORD_CLIENT_ID} />;
    throw err;
  }
  await syncUserGuildAccess(db, session.user.id, guilds);

  const manageable = guilds.filter(canManageGuild).sort((a, b) => a.name.localeCompare(b.name));
  const installed = await db.guild.findMany({
    where: { id: { in: manageable.map((g) => g.id) }, botPresent: true },
    select: { id: true, lastSyncAt: true, _count: { select: { alerts: { where: { status: "OPEN" } } } } },
  });
  const byId = new Map(installed.map((g) => [g.id, g]));
  const ordered = [...manageable.filter((g) => byId.has(g.id)), ...manageable.filter((g) => !byId.has(g.id))];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Select a server</h1>
      <p className="mt-1.5 text-sm text-muted">Servers where you are the owner or have Administrator or Manage Server. Permissions are verified with Discord on every visit.</p>

      {ordered.length === 0 ? (
        <div className="card mt-8">
          <EmptyState
            icon={ServerOff}
            title="No manageable servers"
            description="Integris can only be added by members with Manage Server. Ask a server owner to grant it, or create your own server to try Integris."
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {ordered.map((g) => {
            const install = byId.get(g.id);
            const icon = guildIconUrl(g.id, g.icon, 96);
            return (
              <li key={g.id} className="card flex items-center gap-4 p-4">
                <Avatar src={icon} alt="" fallback={initials(g.name)} className="size-11 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{g.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {install ? (
                      <>
                        <Badge tone="healthy">Protected</Badge>
                        <span>{install.lastSyncAt ? `Synced ${timeAgo(install.lastSyncAt)}` : "Initial scan pending"}</span>
                        {install._count.alerts > 0 ? <Badge tone="critical">{install._count.alerts} open alerts</Badge> : null}
                      </>
                    ) : (
                      <Badge>Not installed</Badge>
                    )}
                  </div>
                </div>
                {install ? (
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/dashboard/${g.id}`}>
                      Open <ArrowRight />
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" asChild>
                    <a href={buildBotInviteUrl(env().DISCORD_CLIENT_ID, g.id)}>
                      <Plus /> Add Integris
                    </a>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-subtle">Just added Integris? It can take a few seconds to appear. Reload the page.</p>
    </main>
  );
}
