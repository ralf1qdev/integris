import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import type { Metadata } from "next";
import { AutoRefresh } from "@/components/marketing/auto-refresh";
import { formatDateTime } from "@/lib/format";
import { getSystemStatus, type ComponentState } from "@/lib/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Status", description: "Live status of the Integris website, bot and monitoring services." };
export const dynamic = "force-dynamic";

const STATE = {
  operational: { label: "Operational", icon: CheckCircle2, text: "text-healthy", ring: "border-healthy/25 bg-healthy/10" },
  degraded: { label: "Degraded", icon: CircleAlert, text: "text-warning", ring: "border-warning/25 bg-warning/10" },
  down: { label: "Outage", icon: CircleX, text: "text-critical", ring: "border-critical/30 bg-critical/10" },
} satisfies Record<ComponentState, unknown>;

const HEADLINE: Record<ComponentState, string> = {
  operational: "All systems operational",
  degraded: "Some systems are degraded",
  down: "Integris is experiencing an outage",
};

export default async function StatusPage() {
  const status = await getSystemStatus();
  const overall = STATE[status.overall];
  const OverallIcon = overall.icon;

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <AutoRefresh seconds={30} />
      <h1 className="text-4xl font-semibold tracking-tight">System status</h1>
      <p className="mt-3 text-muted">Live checks of every Integris service. This page refreshes every 30 seconds.</p>

      <div className={cn("mt-10 flex items-center gap-4 rounded-2xl border p-6", overall.ring)}>
        <OverallIcon className={cn("size-7 shrink-0", overall.text)} />
        <div>
          <p className="text-lg font-semibold">{HEADLINE[status.overall]}</p>
          <p className="mt-0.5 text-sm text-muted">Last checked {formatDateTime(status.checkedAt)}</p>
        </div>
      </div>

      <ul className="card mt-6 divide-y divide-border/70">
        {status.components.map((c) => {
          const s = STATE[c.state];
          const Icon = s.icon;
          return (
            <li key={c.key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="mt-0.5 text-xs text-muted">{c.detail}</p>
              </div>
              <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-sm font-medium", s.text)}>
                <Icon className="size-4" /> {s.label}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-subtle">
        Statuses come from real checks: the database and job queue are queried on every load, and the monitoring worker and Discord bot each report a heartbeat every 20 seconds. Incident updates are posted in the
        #status channel of the Integris Discord server. Machine-readable status: <code className="text-muted">/api/status</code>.
      </p>
    </div>
  );
}
