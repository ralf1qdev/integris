import { getGuildOverview } from "@integris/database";
import { SECURITY_STATUS_LABEL } from "@integris/security/score";
import { Bell, Bot, Link2, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { SeverityBadge } from "@/components/dashboard/badges";
import { EmptyState } from "@/components/dashboard/empty-state";
import { EventFeed } from "@/components/dashboard/event-feed";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScanButton } from "@/components/dashboard/scan-button";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkGuildAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";

const STATUS_TEXT = {
  HEALTHY: "No open high-severity findings. Keep reviewing new integrations as they appear.",
  NEEDS_ATTENTION: "Some findings deserve a look. Review the permission risks below.",
  AT_RISK: "Critical or many high-severity findings are open. Review them first.",
} as const;

export default async function OverviewPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const gate = await checkGuildAccess(guildId);
  if (!gate.ok) return null; // layout renders the denial
  const { guild } = gate;
  const [o, trustedWebhooks] = await Promise.all([
    getGuildOverview(db, guildId),
    db.trustedIntegration.count({ where: { guildId, kind: "WEBHOOK" } }),
  ]);
  const scanRunning = o.latestScan?.status === "QUEUED" || o.latestScan?.status === "RUNNING";
  const base = `/dashboard/${guildId}`;
  const synced = Boolean(guild.lastSyncAt);

  return (
    <>
      <PageHeader
        title="Security overview"
        description={
          synced ? (
            <>
              Last successful sync <span title={formatDateTime(guild.lastSyncAt)}>{timeAgo(guild.lastSyncAt)}</span>.
              {guild.lastSyncError ? <span className="mt-1 block text-warning">{guild.lastSyncError}</span> : null}
            </>
          ) : (
            "Integris has not completed its first scan of this server yet."
          )
        }
        actions={<ScanButton guildId={guildId} initiallyRunning={scanRunning} label={synced ? "Run scan" : "Run initial scan"} />}
      />

      <SetupChecklist
        steps={[
          { label: "Sign in with Discord", done: true, hint: "Verified with Discord" },
          { label: "Add Integris to the server", done: true, hint: "Bot connected" },
          { label: "Run the initial scan", done: synced, hint: "Builds the bot and webhook inventory" },
          { label: "Review findings", done: synced && o.openFindingCount === 0, href: `${base}/bots`, hint: "Start with the highest severity" },
          { label: "Choose an alert channel", done: o.alertChannelConfigured, href: `${base}/settings`, hint: "Or run /setup in Discord" },
          { label: "Approve known webhooks", done: synced && trustedWebhooks >= o.webhookCount, href: `${base}/webhooks`, hint: "Get alerts when trusted ones change" },
        ]}
      />

      {!synced ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title={scanRunning ? "Initial scan in progress" : "Waiting for the initial scan"}
            description="The first scan inventories every bot, role, channel overwrite and webhook Integris can see. It usually finishes in under a minute. No data is shown until real results exist."
            action={scanRunning ? undefined : <ScanButton guildId={guildId} label="Run initial scan" />}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <Card className="flex flex-col items-center p-6 text-center sm:flex-row sm:text-left lg:flex-col lg:text-center">
              <ScoreRing score={o.score.score} status={o.score.status} />
              <div className="mt-4 sm:ml-6 sm:mt-0 lg:ml-0 lg:mt-5">
                <p className="text-xs uppercase tracking-wider text-subtle">Overall status</p>
                <p className={`mt-1 text-lg font-semibold ${o.score.status === "HEALTHY" ? "text-healthy" : o.score.status === "AT_RISK" ? "text-critical" : "text-warning"}`}>
                  {SECURITY_STATUS_LABEL[o.score.status]}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{STATUS_TEXT[o.score.status]}</p>
                <Link href="/docs#security-score" className="mt-3 inline-block text-xs text-secondary hover:underline">
                  How the score is calculated
                </Link>
              </div>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Bots detected" value={o.botCount} icon={Bot} href={`${base}/bots`} hint={o.adminBots ? `${o.adminBots} with Administrator` : "None with Administrator"} tone={o.adminBots ? "warning" : "neutral"} />
              <StatCard label="Webhooks detected" value={o.webhookCount} icon={Link2} href={`${base}/webhooks`} hint="Visible through the Discord API" />
              <StatCard
                label="Active alerts"
                value={o.activeAlerts}
                icon={Bell}
                href={`${base}/alerts`}
                tone={o.activeAlerts ? "critical" : "healthy"}
                hint={o.activeAlerts ? `${o.alertsBySeverity.CRITICAL ?? 0} critical · ${o.alertsBySeverity.HIGH ?? 0} high` : "Nothing needs attention"}
              />
              <StatCard label="Open findings" value={o.openFindingCount} icon={ShieldAlert} tone={o.openFindingCount ? "warning" : "healthy"} hint="Excludes informational findings" href={`${base}/bots`} />
            </div>
          </div>

          <div className="mt-4">
            <ActivityChart guildId={guildId} />
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Permission risks</CardTitle>
                  <CardDescription>Highest-severity open findings for bot accounts.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {o.permissionRisks.length === 0 ? (
                  <EmptyState icon={ShieldCheck} title="No permission risks" description="No bot currently holds permissions Integris flags." />
                ) : (
                  <ul className="divide-y divide-border/60">
                    {o.permissionRisks.map((r) => (
                      <li key={r.id}>
                        <Link href={`${base}/bots/${r.targetId}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-surface-2/60">
                          <div className="min-w-0">
                            <p className="truncate text-sm">{r.title}</p>
                            <p className="truncate text-xs text-muted">{r.targetName ?? r.targetId}</p>
                          </div>
                          <SeverityBadge severity={r.severity} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Recent security events</CardTitle>
                  <CardDescription>Observed changes and administrator actions.</CardDescription>
                </div>
                <Link href={`${base}/activity`} className="text-xs text-secondary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="pt-1">
                {o.recentEvents.length === 0 ? (
                  <EmptyState icon={ShieldCheck} title="No events yet" description="Changes to bots, roles and webhooks will appear here as they happen." />
                ) : (
                  <EventFeed guildId={guildId} events={o.recentEvents} compact />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
