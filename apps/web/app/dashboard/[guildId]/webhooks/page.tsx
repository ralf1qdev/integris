import { listFindings, listWebhooks } from "@integris/database";
import { WEBHOOK_TYPE_LABELS, webhookAvatarUrl } from "@integris/shared";
import { Info, Link2 } from "lucide-react";
import type { Metadata } from "next";
import { Avatar, initials } from "@/components/dashboard/avatar";
import { SeverityBadge, StatusBadge, TrustBadge } from "@/components/dashboard/badges";
import { DeleteWebhookDialog } from "@/components/dashboard/delete-webhook-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScanButton } from "@/components/dashboard/scan-button";
import { StatusActions } from "@/components/dashboard/status-actions";
import { TrustControl } from "@/components/dashboard/trust-control";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { checkGuildAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const gate = await checkGuildAccess(guildId);
  if (!gate.ok) return null;

  const [webhooks, trusted, findings, settings] = await Promise.all([
    listWebhooks(db, guildId, { includeDeleted: true }),
    db.trustedIntegration.findMany({ where: { guildId, kind: "WEBHOOK" } }),
    listFindings(db, guildId, { targetType: "WEBHOOK", status: ["OPEN", "ACKNOWLEDGED"] }),
    db.guildSettings.findUnique({ where: { guildId } }),
  ]);
  const trust = new Map(trusted.map((t) => [t.targetId, t]));
  const restricted = new Set(settings?.restrictedChannelIds ?? []);
  const active = webhooks.filter((w) => w.status === "ACTIVE");
  const deleted = webhooks.filter((w) => w.status === "DELETED");
  const significant = findings.filter((f) => f.severity !== "INFO");
  const permissionIssue = gate.guild.lastSyncError?.includes("Manage Webhooks");

  return (
    <>
      <PageHeader
        title="Webhook security"
        description="Webhooks visible through the Discord API. Integris never stores or displays webhook tokens or URLs."
        actions={<ScanButton guildId={guildId} />}
      />

      {permissionIssue ? (
        <div className="mb-4 flex gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-muted">{gate.guild.lastSyncError} Grant it in Server Settings → Roles → Integris, then run a scan.</p>
        </div>
      ) : null}

      {significant.length ? (
        <Card className="mb-4">
          <CardHeader>
            <div>
              <CardTitle>Open webhook findings</CardTitle>
              <CardDescription>Approve known webhooks to resolve review findings, or delete unexpected ones.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {significant.map((f) => (
                <li key={f.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <StatusBadge status={f.status} />
                    </div>
                    <p className="mt-1.5 text-sm">{f.title}</p>
                    <p className="text-xs text-muted">{f.description}</p>
                  </div>
                  <StatusActions guildId={guildId} kind="findings" id={f.id} status={f.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        {active.length === 0 ? (
          <EmptyState
            icon={Link2}
            title={gate.guild.lastSyncAt ? "No webhooks found" : "No inventory yet"}
            description={gate.guild.lastSyncAt ? "Integris did not find any webhooks in this server." : "Run the initial scan to inventory webhooks."}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Webhook</Th>
                <Th>Channel</Th>
                <Th className="hidden md:table-cell">Creator</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">First detected</Th>
                <Th className="hidden 2xl:table-cell">Last change</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {active.map((w) => {
                const name = w.name ?? "Unnamed webhook";
                const t = trust.get(w.webhookId);
                return (
                  <Tr key={w.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar src={webhookAvatarUrl(w.webhookId, w.avatar)} alt="" fallback={initials(name)} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{name}</p>
                          <p className="font-mono text-[11.5px] text-subtle">{w.webhookId}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-muted">{w.channelName ? `#${w.channelName}` : "Unknown"}</span>
                      {w.channelId && restricted.has(w.channelId) ? <span className="ml-2 text-[11px] text-warning">Restricted</span> : null}
                      <span className="block text-[11px] text-subtle">{WEBHOOK_TYPE_LABELS[w.type] ?? "Unknown type"}</span>
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted md:table-cell">
                      {w.creatorName ?? "Unknown"}
                      {w.creatorIsBot ? <span className="ml-1.5 text-[11px] text-subtle">(bot)</span> : null}
                    </Td>
                    <Td>
                      <TrustBadge trusted={Boolean(t)} protectedHook={t?.protected} />
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted lg:table-cell" title={formatDateTime(w.firstSeenAt)}>
                      {timeAgo(w.firstSeenAt)}
                    </Td>
                    <Td className="hidden text-muted 2xl:table-cell">{w.lastChangedAt ? `${w.lastChangeSummary ?? "Changed"} · ${timeAgo(w.lastChangedAt)}` : "No changes observed"}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <TrustControl guildId={guildId} kind="WEBHOOK" targetId={w.webhookId} name={name} trusted={Boolean(t)} isProtected={t?.protected} size="sm" />
                        <DeleteWebhookDialog guildId={guildId} webhookId={w.webhookId} name={name} channelName={w.channelName} />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {deleted.length ? (
        <details className="card mt-4 px-5 py-4">
          <summary className="cursor-pointer text-sm text-muted">Deleted webhooks ({deleted.length})</summary>
          <ul className="mt-3 divide-y divide-border/60 text-sm">
            {deleted.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-4 py-2.5">
                <span className="truncate">
                  {w.name ?? "Unnamed webhook"} <span className="text-xs text-subtle">{w.channelName ? `#${w.channelName}` : ""}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {w.lastChangeSummary ?? "Deleted"} · {timeAgo(w.deletedAt)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-subtle">
        Discord does not let integrations observe ordinary webhook requests, so Integris cannot see who posts through a webhook, count its messages, or measure its sending rate. It detects creation, configuration changes and deletion through Gateway events, the audit log and periodic reconciliation scans.
      </p>
    </>
  );
}
