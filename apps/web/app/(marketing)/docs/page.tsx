import { DANGEROUS_PERMISSIONS } from "@integris/security/dangerous";
import { PERMISSION_LABELS } from "@integris/security/permissions";
import { SEVERITY_WEIGHT } from "@integris/security/score";
import type { Metadata } from "next";
import { SeverityBadge } from "@/components/dashboard/badges";
import type { Severity } from "@integris/shared";

export const metadata: Metadata = { title: "Documentation" };

const TOC = [
  ["getting-started", "Getting started"],
  ["permissions", "Permissions & intents"],
  ["monitoring", "How monitoring works"],
  ["rules", "Detection rules"],
  ["security-score", "Security score"],
  ["alerts", "Alerts"],
  ["commands", "Slash commands"],
  ["limitations", "Limitations"],
  ["privacy", "Data & privacy"],
  ["data-deletion", "Deleting your data"],
] as const;

const OTHER_RULES: { id: string; severity: Severity; d: string }[] = [
  { id: "bot.administrator", severity: "HIGH", d: "Bot holds Administrator. Raised to Critical only when Discord reports the bot as unverified." },
  { id: "bot.role-hierarchy", severity: "HIGH", d: "Bot has Manage Roles and is above assignable (non-managed) roles carrying permissions it lacks. High if one of them has Administrator, otherwise Medium." },
  { id: "bot.channel-overwrite", severity: "MEDIUM", d: "Channel overwrites grant Manage Webhooks or Manage Permissions (Medium), or Manage Channel, Mention Everyone or Manage Messages (Low), beyond the server-wide set." },
  { id: "bot.unverified-privileged", severity: "MEDIUM", d: "Bot is not verified by Discord and has at least one Medium-or-higher finding." },
  { id: "webhook.restricted-channel", severity: "HIGH", d: "Unapproved webhook in a channel you marked as restricted." },
  { id: "webhook.created-by-bot", severity: "LOW", d: "Unapproved incoming webhook created by a bot account." },
  { id: "webhook.unreviewed", severity: "INFO", d: "Webhook not yet approved. Informational; does not affect the score." },
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 border-t border-border pt-10 text-2xl font-semibold tracking-tight first:border-0 first:pt-0">
      {children}
    </h2>
  );
}

const P = ({ children }: { children: React.ReactNode }) => <p className="mt-4 leading-relaxed text-muted">{children}</p>;

export default function DocsPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Documentation" className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">On this page</p>
        <ul className="mt-3 space-y-2 text-sm">
          {TOC.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-muted hover:text-foreground">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="min-w-0 max-w-3xl space-y-10">
        <header>
          <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
          <P>How Integris works, what it can and cannot see, and exactly how every finding and score is calculated.</P>
        </header>

        <section>
          <H2 id="getting-started">Getting started</H2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
            <li>Sign in with Discord. Integris lists servers where you are the owner or have Administrator or Manage Server.</li>
            <li>Choose a server and select <strong className="text-foreground">Add Integris</strong>. Discord shows the exact permissions requested.</li>
            <li>The initial scan starts automatically and usually completes within a minute.</li>
            <li>Review findings on the Bots and Webhooks pages. Approve integrations you recognise.</li>
            <li>
              Choose an alert channel in Settings, or run <code className="text-foreground">/setup</code> in Discord.
            </li>
          </ol>
        </section>

        <section>
          <H2 id="permissions">Permissions & intents</H2>
          <P>Integris requests the minimum it needs and never asks for Administrator.</P>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {[
                  ["View Audit Log", "Attribute changes to the person who made them, when Discord records one."],
                  ["View Channels", "Read channel names and permission overwrites."],
                  ["Send Messages, Embed Links", "Deliver alerts to the channel you choose."],
                  ["Manage Webhooks", "Discord only lists webhooks to members with this permission. Also used for the confirmed emergency delete."],
                  ["Server Members intent (privileged)", "Detect bot accounts joining, leaving and changing roles. Enable it in the Developer Portal."],
                  ["Guild Moderation, Webhooks, Integrations intents", "Receive audit-log entries and change notifications. No message content intent is used."],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="w-56 px-4 py-3 align-top font-medium">{k}</td>
                    <td className="px-4 py-3 text-muted">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <H2 id="monitoring">How monitoring works</H2>
          <P>
            Integris combines three sources. <strong className="text-foreground">Gateway events</strong> report bot joins and departures, role and channel changes, and that webhooks changed in a channel.{" "}
            <strong className="text-foreground">Audit-log entries</strong> identify who made a change when Discord records it. <strong className="text-foreground">Reconciliation scans</strong> — on install, on
            request and every few hours — re-read the full state and catch anything no event was emitted for.
          </P>
          <P>
            Discord does not emit an event for every change, and audit-log entries do not always contain full before-and-after data or a reliable actor. When a detail is not available, Integris shows
            <em> Unknown</em> rather than guessing. The first scan establishes a baseline: existing bots and webhooks are recorded without &ldquo;created&rdquo; events, and only high and critical findings raise alerts.
          </P>
        </section>

        <section>
          <H2 id="rules">Detection rules</H2>
          <P>
            Every finding comes from a deterministic rule evaluated against effective permissions (computed with Discord&apos;s documented algorithm). Powerful permissions are a risk factor, not evidence that a bot is
            malicious. Severities below apply to untrusted bots at server level.
          </P>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-subtle">
                  <th className="px-4 py-2.5 font-medium">Rule</th>
                  <th className="px-4 py-2.5 font-medium">Severity</th>
                  <th className="px-4 py-2.5 font-medium">Why it matters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {DANGEROUS_PERMISSIONS.filter((d) => d.name !== "Administrator").map((d) => (
                  <tr key={d.name}>
                    <td className="px-4 py-3 align-top font-mono text-xs">bot.permission.{d.name}</td>
                    <td className="px-4 py-3 align-top">
                      <SeverityBadge severity={d.severity} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <span className="text-foreground">{PERMISSION_LABELS[d.name]}.</span> {d.impact}
                    </td>
                  </tr>
                ))}
                {OTHER_RULES.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 align-top font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-3 align-top">
                      <SeverityBadge severity={r.severity} />
                    </td>
                    <td className="px-4 py-3 text-muted">{r.d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Event rules raise alerts for: a new bot joining (at least Medium, higher if its permissions warrant), a bot gaining Administrator (Critical; High if trusted) or another sensitive permission (High;
            Medium if trusted), an unapproved webhook being created (Medium; High in a restricted channel), a protected webhook being modified or deleted (High), and webhook deletion (Low; Medium if approved).
          </P>
        </section>

        <section>
          <H2 id="security-score">Security score</H2>
          <P>The score starts at 100 and subtracts a fixed weight for each open finding. Acknowledged findings — accepted risks — count half. Resolved findings count zero.</P>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface p-4 font-mono text-[13px] leading-relaxed text-foreground">
            {`score = max(0, round(100 − Σ weight × factor))

weight:  ${Object.entries(SEVERITY_WEIGHT)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
factor:  OPEN 1 · ACKNOWLEDGED 0.5 · RESOLVED 0

At risk          any open CRITICAL finding, or score < 50
Needs attention  any open HIGH finding, or score < 80
Healthy          otherwise`}
          </pre>
          <P>There are no AI-generated threat probabilities or hidden factors. The same findings always produce the same score.</P>
        </section>

        <section>
          <H2 id="alerts">Alerts</H2>
          <P>
            Each alert has a severity, title, description, affected resource, timestamp, evidence, recommended response and status (Open, Acknowledged, Resolved). Every alert appears in the dashboard; those at or above
            your chosen severity are also posted to your alert channel with Acknowledge and Resolve buttons, which check that the clicker has Manage Server.
          </P>
          <P>
            Integris never alerts twice for the same unchanged finding. A resolved alert does not reappear within the cooldown window (60 minutes by default). Alerts linked to a finding resolve automatically when the
            condition clears.
          </P>
        </section>

        <section>
          <H2 id="commands">Slash commands</H2>
          <P>All commands require Manage Server and reply privately (ephemeral).</P>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              ["/security", "Overall status, score, counts and top risks."],
              ["/scan", "Request a fresh reconciliation scan (rate limited)."],
              ["/bots", "Installed bots with risk level and sensitive permissions."],
              ["/webhooks", "Webhook inventory with approval status and findings."],
              ["/alerts", "Open and acknowledged alerts."],
              ["/dashboard", "A link to this server's dashboard."],
              ["/setup", "Choose the alert channel, severity threshold and optional role mention."],
            ].map(([c, d]) => (
              <li key={c} className="flex gap-3">
                <code className="w-24 shrink-0 font-mono text-secondary">{c}</code>
                <span className="text-muted">{d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <H2 id="limitations">Limitations</H2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
            <li>Integris cannot inspect a third-party bot&apos;s source code, credentials, hosting or internal behaviour. It evaluates what the bot is permitted to do in your server.</li>
            <li>
              Discord does not expose ordinary webhook requests to integrations. Integris cannot identify every webhook message, see who posted through a webhook, or calculate per-webhook sending rates. Enforcing posting
              limits would require a separate managed relay where Integris controls the inbound endpoint — that is not part of the current release.
            </li>
            <li>Actors are only known when Discord records them in the audit log and Integris can read it.</li>
            <li>Changes made while Integris is offline are detected by the next reconciliation scan, not in real time.</li>
            <li>Trust is a local decision for your server. It is not proof that an integration is safe.</li>
            <li>Integris never bans, kicks or removes bots automatically.</li>
          </ul>
        </section>

        <section>
          <H2 id="privacy">Data & privacy</H2>
          <P>
            Integris stores: your Discord user ID, username and avatar; encrypted OAuth tokens (AES-256-GCM, never sent to the browser); and for each server, its name, roles, channel names and overwrites, the bot and
            webhook inventory, findings, alerts, settings and an activity log.
          </P>
          <P>
            Integris does <strong className="text-foreground">not</strong> store message content, member lists of human users, or webhook tokens and URLs — those are discarded the moment Discord returns them and are
            redacted from every log. Sessions are HTTP-only cookies backed by server-side records; signing out of your last session revokes Integris&apos; Discord token.
          </P>
          <P>History is deleted automatically after the retention period you choose (90 days by default). Servers that remove Integris are erased after 30 days.</P>
        </section>

        <section>
          <H2 id="data-deletion">Deleting your data</H2>
          <P>
            The server owner or an Administrator can permanently delete all Integris data for a server from Settings → Delete server data, optionally removing the bot at the same time. A minimal record (server ID,
            name, requester, time) is kept to make the deletion auditable.
          </P>
        </section>
      </article>
    </div>
  );
}
