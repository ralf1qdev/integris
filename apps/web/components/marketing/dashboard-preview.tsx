import { Bell, Bot, Link2, ShieldAlert } from "lucide-react";

/**
 * A static product illustration for the landing page. It is labelled as an
 * example and is never shown as real server data.
 */
const ROWS = [
  { name: "Moderation Bot", perms: ["Ban Members", "Kick Members"], risk: "Elevated", tone: "text-warning bg-warning/10 border-warning/25" },
  { name: "Music Player", perms: ["Standard permissions"], risk: "No findings", tone: "text-healthy bg-healthy/10 border-healthy/25" },
  { name: "Giveaway Helper", perms: ["Administrator"], risk: "High risk", tone: "text-high bg-high/10 border-high/25" },
];

export function DashboardPreview() {
  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="card overflow-hidden p-0 shadow-[0_40px_120px_-40px_rgb(88_101_242/0.35)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="ml-3 text-xs text-subtle">Example server · Security overview</span>
          <span className="ml-auto rounded-md border border-border px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-subtle">Illustration</span>
        </div>
        <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-[200px_1fr]">
          <div className="hidden flex-col gap-1 md:flex">
            {["Overview", "Bots", "Webhooks", "Alerts", "Activity", "Settings"].map((n, i) => (
              <div key={n} className={`rounded-lg px-3 py-2 text-sm ${i === 0 ? "bg-surface-2 text-foreground" : "text-muted"}`}>
                {n}
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { l: "Security score", v: "78", i: ShieldAlert, c: "text-warning" },
                { l: "Bots", v: "12", i: Bot, c: "text-subtle" },
                { l: "Webhooks", v: "9", i: Link2, c: "text-subtle" },
                { l: "Active alerts", v: "2", i: Bell, c: "text-critical" },
              ].map(({ l, v, i: Icon, c }) => (
                <div key={l} className="rounded-xl border border-border bg-surface-2/60 p-3.5">
                  <div className="flex items-center justify-between text-xs text-muted">
                    {l}
                    <Icon className={`size-3.5 ${c}`} />
                  </div>
                  <div className="mt-2 text-xl font-semibold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-surface-2/40">
              {ROWS.map((r) => (
                <div key={r.name} className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3">
                      <Bot className="size-4 text-muted" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.name}</p>
                      <p className="truncate text-xs text-muted">{r.perms.join(" · ")}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${r.tone}`}>{r.risk}</span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-critical/25 bg-critical/5 px-4 py-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-critical" />
              <div>
                <p className="text-sm">Suspicious permission escalation</p>
                <p className="text-xs text-muted">Giveaway Helper gained Administrator · Role “Helpers” changed · 2 minutes ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
