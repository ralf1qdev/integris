import { Activity, Bell, Bot, KeyRound, Layers, Link2, ScanSearch, ShieldCheck, Terminal, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Features" };

const SECTIONS = [
  {
    title: "Bot security",
    icon: Bot,
    items: [
      { icon: KeyRound, t: "Effective permissions", d: "Computed with Discord's own algorithm: @everyone, every held role, then channel overwrites in order." },
      { icon: Layers, t: "Role hierarchy analysis", d: "Flags bots with Manage Roles positioned above roles that carry permissions they lack — a real escalation path." },
      { icon: ShieldCheck, t: "Local trust", d: "Mark known bots as trusted and add notes. Trust never hides a later permission increase." },
      { icon: Activity, t: "Permission change history", d: "Every observed gain or loss of permissions, with the actor when Discord records one." },
    ],
  },
  {
    title: "Webhook protection",
    icon: Link2,
    items: [
      { icon: ScanSearch, t: "Discovery and reconciliation", d: "Webhook changes are detected from Gateway events and the audit log, then verified by full reconciliation scans." },
      { icon: ShieldCheck, t: "Approved and protected webhooks", d: "Approve known webhooks; protect critical ones to get high-severity alerts on any modification." },
      { icon: Bell, t: "Restricted channels", d: "Any unapproved webhook in announcement, rules or staff channels becomes a high-severity finding." },
      { icon: Trash2, t: "Emergency delete", d: "Delete an unexpected webhook from the dashboard after typing its name. Recorded in both audit logs." },
    ],
  },
  {
    title: "Alerts and operations",
    icon: Bell,
    items: [
      { icon: Bell, t: "Actionable alerts", d: "Severity, evidence, affected resource and a recommended response — in the dashboard and your staff channel." },
      { icon: Layers, t: "Deduplication", d: "Unchanged findings never alert twice; resolved alerts respect a configurable cooldown." },
      { icon: Terminal, t: "Slash commands", d: "/security, /scan, /bots, /webhooks, /alerts, /dashboard and /setup — ephemeral and permission-checked." },
      { icon: ScanSearch, t: "Scheduled scans", d: "Periodic reconciliation catches anything Discord did not emit an event for." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">Purpose-built for third-party integration risk.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">Integris focuses on the bots, webhooks and permissions connected to your server — the part of Discord security moderation bots don&apos;t cover.</p>
      <div className="mt-16 space-y-16">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <div className="flex items-center gap-3">
              <s.icon className="size-5 text-secondary" />
              <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {s.items.map((i) => (
                <div key={i.t} className="card p-5">
                  <i.icon className="size-4 text-subtle" />
                  <p className="mt-3 font-medium">{i.t}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{i.d}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-16 rounded-xl border border-border bg-surface/60 p-6">
        <h2 className="font-semibold">What Integris deliberately does not do</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>It does not ban, kick or remove bots automatically.</li>
          <li>It does not claim to inspect bot source code, credentials or internal behaviour.</li>
          <li>It does not intercept or count ordinary webhook messages — Discord does not expose them.</li>
          <li>It does not produce AI-generated threat probabilities. Every finding comes from a documented rule.</li>
        </ul>
      </div>
      <div className="mt-12 flex gap-3">
        <Button asChild>
          <a href="/invite">Add to Discord</a>
        </Button>
        <Button variant="secondary" asChild>
          <a href="/docs">Documentation</a>
        </Button>
      </div>
    </div>
  );
}
