import { listAlerts } from "@integris/database";
import { BellOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SeverityBadge, StatusBadge } from "@/components/dashboard/badges";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusActions } from "@/components/dashboard/status-actions";
import { Card } from "@/components/ui/card";
import { checkGuildAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Alerts" };

const FILTERS = {
  active: { label: "Active", status: ["OPEN", "ACKNOWLEDGED"] as const },
  resolved: { label: "Resolved", status: ["RESOLVED"] as const },
  all: { label: "All", status: undefined },
};

function humanize(k: string) {
  return k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export default async function AlertsPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ filter?: string; alert?: string; cursor?: string }> }) {
  const { guildId } = await params;
  const sp = await searchParams;
  const gate = await checkGuildAccess(guildId);
  if (!gate.ok) return null;

  const filterKey = (sp.filter && sp.filter in FILTERS ? sp.filter : "active") as keyof typeof FILTERS;
  const filter = FILTERS[filterKey];
  const [{ items, nextCursor }, settings] = await Promise.all([
    listAlerts(db, guildId, { status: filter.status ? [...filter.status] : undefined, limit: 30, cursor: sp.cursor?.slice(0, 40) }),
    db.guildSettings.findUnique({ where: { guildId } }),
  ]);
  const base = `/dashboard/${guildId}/alerts`;

  return (
    <>
      <PageHeader
        title="Security alerts"
        description={
          settings?.alertChannelId ? (
            <>Alerts at {settings.alertMinSeverity.toLowerCase()} severity or higher are also delivered to Discord. Repeats of an unchanged finding are grouped instead of re-sent.</>
          ) : (
            <>
              No alert channel is configured, so alerts only appear here.{" "}
              <Link href={`/dashboard/${guildId}/settings`} className="text-secondary hover:underline">
                Choose a channel
              </Link>
              .
            </>
          )
        }
      />

      <div role="tablist" className="mb-4 flex gap-1">
        {Object.entries(FILTERS).map(([key, f]) => (
          <Link
            key={key}
            role="tab"
            aria-selected={key === filterKey}
            href={`${base}?filter=${key}`}
            className={cn("rounded-lg px-3 py-1.5 text-sm transition-colors", key === filterKey ? "bg-surface-2 text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]" : "text-muted hover:text-foreground")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={BellOff}
            title={filterKey === "active" ? "No active alerts" : "No alerts"}
            description="Integris raises alerts for new bots, unexpected webhooks, protected webhook changes and permission escalations."
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => {
            const evidence = a.evidence && typeof a.evidence === "object" && !Array.isArray(a.evidence) ? Object.entries(a.evidence as Record<string, unknown>) : [];
            return (
              <li key={a.id} id={a.id} className={cn("card p-5", sp.alert === a.id && "border-primary/50", a.status === "RESOLVED" && "opacity-75")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <StatusBadge status={a.status} />
                      {a.occurrences > 1 ? <span className="text-xs text-muted">Seen {a.occurrences} times</span> : null}
                    </div>
                    <h2 className="mt-2 text-[15px] font-medium">{a.title}</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {a.resourceType.charAt(0) + a.resourceType.slice(1).toLowerCase()}: {a.resourceName ?? "Unknown"}
                      {a.resourceId ? <span className="font-mono"> · {a.resourceId}</span> : null}
                      <span> · </span>
                      <time title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</time>
                    </p>
                  </div>
                  <StatusActions guildId={guildId} kind="alerts" id={a.id} status={a.status} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{a.description}</p>
                {evidence.length ? (
                  <dl className="mt-3 grid gap-x-4 gap-y-1.5 rounded-lg border border-border bg-background/60 p-3 text-xs sm:grid-cols-[160px_1fr]">
                    {evidence.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-subtle">{humanize(k)}</dt>
                        <dd className="break-words text-muted">{Array.isArray(v) ? v.join(", ") || "None" : v === null || v === undefined ? "Unknown" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <p className="mt-3 text-[13px]">
                  <span className="text-subtle">Recommended response: </span>
                  <span className="text-muted">{a.recommendation}</span>
                </p>
                <p className="mt-3 border-t border-border/60 pt-3 text-xs text-subtle">
                  {a.deliveredAt
                    ? `Delivered to Discord ${timeAgo(a.deliveredAt)}`
                    : a.deliveryError
                      ? `Discord delivery failed: ${a.deliveryError}`
                      : "Not sent to Discord (no channel configured, or below the delivery threshold)"}
                  {a.status === "ACKNOWLEDGED" && a.acknowledgedAt ? ` · Acknowledged ${timeAgo(a.acknowledgedAt)}` : ""}
                  {a.status === "RESOLVED" && a.resolvedAt ? ` · Resolved ${timeAgo(a.resolvedAt)}${a.resolvedById ? "" : " automatically (condition cleared)"}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Link href={`${base}?filter=${filterKey}&cursor=${nextCursor}`} className="text-sm text-secondary hover:underline">
            Load older alerts
          </Link>
        </div>
      ) : null}
    </>
  );
}
