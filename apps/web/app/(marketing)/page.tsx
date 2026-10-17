import { ArrowRight, Bell, Bot, Check, Eye, KeyRound, Link2, Lock, ScanSearch, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { FadeIn } from "@/components/marketing/fade-in";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Bot,
    title: "Bot Security",
    body: "See every bot account and what it can actually do — calculated from roles, the role hierarchy and channel overwrites.",
    points: ["Effective permission analysis", "Role-hierarchy escalation paths", "Alerts when a bot gains power"],
  },
  {
    icon: Link2,
    title: "Webhook Protection",
    body: "Keep an inventory of every webhook, approve the ones you know, and act quickly on the ones you don't.",
    points: ["Creation, change and deletion tracking", "Protected webhooks and restricted channels", "Confirmed emergency delete"],
  },
  {
    icon: Bell,
    title: "Security Alerts",
    body: "Clear, deduplicated alerts in the dashboard and your staff channel, each with evidence and a recommended response.",
    points: ["Acknowledge or resolve from Discord", "Cooldowns prevent repeat noise", "Severity threshold per server"],
  },
];

const STEPS = [
  { icon: Lock, title: "Sign in with Discord", body: "Integris verifies with Discord which servers you can manage." },
  { icon: ShieldCheck, title: "Add Integris", body: "Invite the bot with five narrowly scoped permissions." },
  { icon: ScanSearch, title: "Initial scan", body: "Bots, roles, overwrites and webhooks are inventoried in seconds." },
  { icon: Bell, title: "Continuous monitoring", body: "Gateway events, the audit log and scheduled scans keep findings current." },
];

const FAQ = [
  {
    q: "Will Integris ban or remove bots automatically?",
    a: "No. Integris never bans, kicks or removes a bot because its permissions look risky. The only destructive action it offers is deleting a webhook, and only after an administrator explicitly confirms it.",
  },
  {
    q: "Can Integris see what a third-party bot does internally?",
    a: "No. Integris evaluates what a bot is allowed to do in your server — its permissions and position — and the changes Discord reports. It cannot inspect a bot's source code, credentials or behaviour.",
  },
  {
    q: "Can it see or rate-limit messages sent through webhooks?",
    a: "Discord does not let integrations observe ordinary webhook requests, so Integris cannot count webhook messages or attribute them. It tracks webhook creation, configuration changes and deletion.",
  },
  {
    q: "How is the security score calculated?",
    a: "With fixed, published weights per open finding (Critical 25, High 10, Medium 4, Low 1), halved for acknowledged findings. No AI-generated threat probabilities. The documentation lists every rule.",
  },
  {
    q: "Who can view a server's dashboard?",
    a: "Only the server owner and members with Administrator or Manage Server. Integris checks this with Discord on the server, never trusting what the browser claims.",
  },
  {
    q: "What does it cost?",
    a: "Integris is free while in beta.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
          <FadeIn>
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-healthy" /> Discord integration security · Free beta
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">Every integration. Under control.</h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Monitor bots, secure webhooks, and protect your Discord server from risky integrations.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <a href="/invite">Add to Discord</a>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/dashboard">
                  Explore Dashboard <ArrowRight />
                </Link>
              </Button>
            </div>
          </FadeIn>
          <FadeIn delay={0.15} className="mt-16 text-left">
            <DashboardPreview />
          </FadeIn>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="features">
        <div>
          <p className="text-sm font-medium text-secondary">Built for integrations</p>
          <h2 id="features" className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">Not another moderation bot. A security layer for everything you've connected.</h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card h-full p-6">
              <div className="grid size-10 place-items-center rounded-lg border border-primary/25 bg-primary/10">
                <f.icon className="size-5 text-secondary" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              <ul className="mt-5 space-y-2">
                {f.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-healthy" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-surface/40" aria-labelledby="how">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="how" className="text-3xl font-semibold tracking-tight">How Integris works</h2>
          <p className="mt-2 max-w-xl text-muted">Simple enough for a Discord server owner. Powerful enough for a serious community.</p>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-sm font-semibold tabular-nums text-secondary">{i + 1}</span>
                  <s.icon className="size-4 text-subtle" />
                </div>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="privacy">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-secondary">Privacy & security</p>
            <h2 id="privacy" className="mt-2 text-3xl font-semibold tracking-tight">A security product should hold itself to a higher bar.</h2>
            <p className="mt-4 leading-relaxed text-muted">
              Integris requests the least access it needs, reads no message content, and keeps credentials out of reach of the browser. Every destructive action requires explicit confirmation and is written to an audit trail.
            </p>
            <Button variant="secondary" className="mt-6" asChild>
              <Link href="/docs#privacy">Read the data policy</Link>
            </Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Eye, t: "No message content", d: "No message-content intent. Integris never reads conversations." },
              { icon: KeyRound, t: "Tokens never exposed", d: "Webhook tokens are discarded on receipt. OAuth tokens are AES-256-GCM encrypted." },
              { icon: ShieldCheck, t: "Server-side authorization", d: "Every request is checked against Discord-verified permissions." },
              { icon: Trash2, t: "Your data, deletable", d: "Configurable retention and one-step deletion of all server data." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="card p-5">
                <Icon className="size-5 text-secondary" />
                <p className="mt-3 text-sm font-medium">{t}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border/60" aria-labelledby="faq">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 id="faq" className="text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
          <div className="mt-8 divide-y divide-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                  {f.q}
                  <span className="text-subtle transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="card flex flex-col items-center gap-6 px-6 py-14 text-center">
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">Know exactly what's connected to your server.</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href="/invite">Add to Discord</a>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
