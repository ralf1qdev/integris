import { guildIconUrl } from "@integris/shared";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { Avatar, initials } from "@/components/dashboard/avatar";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { checkGuildAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export default async function GuildLayout({ children, params }: { children: React.ReactNode; params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const gate = await checkGuildAccess(guildId);
  if (!gate.ok) return <AccessDenied reason={gate.reason} guildId={guildId} clientId={env().DISCORD_CLIENT_ID} />;
  const openAlerts = await db.securityAlert.count({ where: { guildId, status: "OPEN" } });

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:gap-10 lg:py-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 flex items-center gap-3 px-1">
          <Avatar src={guildIconUrl(gate.guild.id, gate.guild.icon, 64)} alt="" fallback={initials(gate.guild.name)} className="size-9 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{gate.guild.name}</p>
            <p className="text-xs text-muted">{gate.access.isOwner ? "Owner" : "Manager"}</p>
          </div>
        </div>
        <SidebarNav guildId={guildId} openAlerts={openAlerts} />
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
