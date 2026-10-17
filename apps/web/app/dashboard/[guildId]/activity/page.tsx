import { listEvents, type AuditEventType } from "@integris/database";
import { Activity } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { EmptyState } from "@/components/dashboard/empty-state";
import { EventFeed } from "@/components/dashboard/event-feed";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { checkGuildAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity" };

const GROUPS: Record<string, { label: string; types?: AuditEventType[] }> = {
  all: { label: "All" },
  bots: { label: "Bots", types: ["BOT_ADDED", "BOT_REMOVED", "BOT_PERMISSIONS_CHANGED", "PERMISSION_ESCALATION"] },
  webhooks: { label: "Webhooks", types: ["WEBHOOK_CREATED", "WEBHOOK_UPDATED", "WEBHOOK_DELETED", "WEBHOOK_DELETED_BY_INTEGRIS"] },
  roles: { label: "Roles & integrations", types: ["ROLE_PERMISSIONS_CHANGED", "INTEGRATION_CREATED", "INTEGRATION_UPDATED", "INTEGRATION_DELETED"] },
  admin: {
    label: "Administrator actions",
    types: ["ALERT_ACKNOWLEDGED", "ALERT_RESOLVED", "ALERT_REOPENED", "FINDING_STATUS_CHANGED", "TRUST_GRANTED", "TRUST_REVOKED", "NOTE_ADDED", "SETTINGS_UPDATED", "DATA_DELETION_REQUESTED"],
  },
  system: { label: "Scans", types: ["SCAN_COMPLETED", "SCAN_FAILED", "INTEGRIS_INSTALLED", "INTEGRIS_REMOVED"] },
};

export default async function ActivityPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ group?: string; cursor?: string }> }) {
  const { guildId } = await params;
  const sp = await searchParams;
  const gate = await checkGuildAccess(guildId);
  if (!gate.ok) return null;
  const groupKey = sp.group && sp.group in GROUPS ? sp.group : "all";
  const { items, nextCursor } = await listEvents(db, guildId, { types: GROUPS[groupKey]!.types, limit: 50, cursor: sp.cursor?.slice(0, 40) });
  const base = `/dashboard/${guildId}/activity`;

  return (
    <>
      <PageHeader title="Activity" description="Every security-relevant change Integris observed, and every action administrators took. Actors are shown only when Discord reports one; otherwise they are listed as Unknown." />
      <ActivityChart guildId={guildId} />
      <div className="mb-3 mt-6 flex flex-wrap gap-1">
        {Object.entries(GROUPS).map(([key, g]) => (
          <Link
            key={key}
            href={`${base}?group=${key}`}
            className={cn("rounded-lg px-3 py-1.5 text-sm transition-colors", key === groupKey ? "bg-surface-2 text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]" : "text-muted hover:text-foreground")}
          >
            {g.label}
          </Link>
        ))}
      </div>
      <Card>
        <CardContent className="pt-2">
          {items.length === 0 ? (
            <EmptyState icon={Activity} title="No events" description="Nothing has been recorded for this filter yet." />
          ) : (
            <EventFeed guildId={guildId} events={items} />
          )}
        </CardContent>
      </Card>
      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Link href={`${base}?group=${groupKey}&cursor=${nextCursor}`} className="text-sm text-secondary hover:underline">
            Load older events
          </Link>
        </div>
      ) : null}
    </>
  );
}
