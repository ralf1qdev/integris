import { listBots } from "@integris/database";
import { RISK_LEVELS, userAvatarUrl } from "@integris/shared";
import { Bot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, initials } from "@/components/dashboard/avatar";
import { RiskBadge, TrustBadge } from "@/components/dashboard/badges";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { PermissionChips } from "@/components/dashboard/permission-chips";
import { ScanButton } from "@/components/dashboard/scan-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { checkGuildAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Bots" };

export default async function BotsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const gate = await checkGuildAccess(guildId);
  if (!gate.ok) return null;

  const [bots, trusted] = await Promise.all([
    listBots(db, guildId, { includeRemoved: true }),
    db.trustedIntegration.findMany({ where: { guildId, kind: "BOT" }, select: { targetId: true } }),
  ]);
  const trustedIds = new Set(trusted.map((t) => t.targetId));
  const rank = (r: string) => RISK_LEVELS.indexOf(r as (typeof RISK_LEVELS)[number]);
  const present = bots.filter((b) => b.isPresent).sort((a, b) => rank(b.riskLevel) - rank(a.riskLevel) || a.username.localeCompare(b.username));
  const removed = bots.filter((b) => !b.isPresent);

  return (
    <>
      <PageHeader
        title="Bot security"
        description="Every bot account in the server, with effective permissions calculated from roles, the role hierarchy and channel overwrites. Powerful permissions are a risk factor, not evidence that a bot is malicious."
        actions={<ScanButton guildId={guildId} />}
      />
      <Card>
        {present.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={gate.guild.lastSyncAt ? "No bots found" : "No inventory yet"}
            description={
              gate.guild.lastSyncError?.includes("Server Members Intent")
                ? gate.guild.lastSyncError
                : gate.guild.lastSyncAt
                  ? "Integris did not find any bot accounts besides itself."
                  : "Run the initial scan to inventory installed bots."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Bot</Th>
                <Th>Effective permissions</Th>
                <Th className="hidden md:table-cell">Highest role</Th>
                <Th>Risk</Th>
                <Th className="hidden lg:table-cell">First detected</Th>
                <Th className="hidden xl:table-cell">Last security event</Th>
              </tr>
            </thead>
            <tbody>
              {present.map((b) => {
                const name = b.globalName ?? b.username;
                return (
                  <Tr key={b.id}>
                    <Td>
                      <Link href={`/dashboard/${guildId}/bots/${b.botUserId}`} className="flex items-center gap-3">
                        <Avatar src={userAvatarUrl(b.botUserId, b.avatar)} alt="" fallback={initials(name)} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-medium hover:underline">
                            {name}
                            {b.isIntegris ? <Badge tone="brand">Integris</Badge> : null}
                          </p>
                          <p className="font-mono text-[11.5px] text-subtle">{b.botUserId}</p>
                        </div>
                      </Link>
                    </Td>
                    <Td className="max-w-72">
                      <PermissionChips permissions={b.permissions} max={3} />
                    </Td>
                    <Td className="hidden text-muted md:table-cell">{b.highestRoleName ?? "None"}</Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        {b.isIntegris ? <Badge>Self</Badge> : <RiskBadge risk={b.riskLevel} />}
                        {trustedIds.has(b.botUserId) ? <TrustBadge trusted /> : null}
                      </div>
                    </Td>
                    <Td className="hidden text-muted lg:table-cell" title={formatDateTime(b.firstSeenAt)}>
                      {timeAgo(b.firstSeenAt)}
                    </Td>
                    <Td className="hidden text-muted xl:table-cell">{b.lastEventAt ? `${b.lastEventSummary ?? "Event"} · ${timeAgo(b.lastEventAt)}` : "None recorded"}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {removed.length ? (
        <details className="card mt-4 px-5 py-4">
          <summary className="cursor-pointer text-sm text-muted">Previously seen bots ({removed.length})</summary>
          <ul className="mt-3 divide-y divide-border/60 text-sm">
            {removed.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5">
                <Link href={`/dashboard/${guildId}/bots/${b.botUserId}`} className="hover:underline">
                  {b.globalName ?? b.username}
                </Link>
                <span className="text-xs text-muted">Removed {timeAgo(b.removedAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
