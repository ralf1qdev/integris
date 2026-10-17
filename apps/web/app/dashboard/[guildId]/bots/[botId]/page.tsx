import { getBot, listEvents, listFindings, listNotes, listRoles } from "@integris/database";
import { DANGEROUS_PERMISSIONS } from "@integris/security/dangerous";
import { has, Permission, PERMISSION_LABELS, permissionNames, toBits } from "@integris/security/permissions";
import { userAvatarUrl } from "@integris/shared";
import { ArrowLeft, Bell, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, initials } from "@/components/dashboard/avatar";
import { RiskBadge, SeverityBadge, StatusBadge, TrustBadge } from "@/components/dashboard/badges";
import { EmptyState } from "@/components/dashboard/empty-state";
import { EventFeed } from "@/components/dashboard/event-feed";
import { NoteForm } from "@/components/dashboard/note-form";
import { StatusActions } from "@/components/dashboard/status-actions";
import { TrustControl } from "@/components/dashboard/trust-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkGuildAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Bot details" };

const DANGEROUS = new Set(DANGEROUS_PERMISSIONS.map((d) => d.name));

function Evidence({ evidence }: { evidence: unknown }) {
  if (!evidence || typeof evidence !== "object") return null;
  const entries = Object.entries(evidence as Record<string, unknown>);
  if (!entries.length) return null;
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-1.5 rounded-lg border border-border bg-background/60 p-3 text-xs sm:grid-cols-[140px_1fr]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-subtle">{k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())}</dt>
          <dd className="break-words text-muted">{Array.isArray(v) ? v.join(", ") || "None" : v === null || v === undefined ? "Unknown" : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function BotDetailPage({ params }: { params: Promise<{ guildId: string; botId: string }> }) {
  const { guildId, botId } = await params;
  const gate = await checkGuildAccess(guildId);
  if (!gate.ok) return null;
  if (!/^\d{15,21}$/.test(botId)) notFound();

  const bot = await getBot(db, guildId, botId);
  if (!bot) notFound();
  const [findings, events, notes, roles, trust] = await Promise.all([
    listFindings(db, guildId, { targetType: "BOT", targetId: botId }),
    listEvents(db, guildId, { targetType: "BOT", targetId: botId, limit: 25 }),
    listNotes(db, guildId, "BOT", botId),
    listRoles(db, guildId),
    db.trustedIntegration.findUnique({ where: { guildId_kind_targetId: { guildId, kind: "BOT", targetId: botId } } }),
  ]);

  const authors = new Map(
    (await db.user.findMany({ where: { id: { in: [...new Set(notes.map((n) => n.authorId))] } }, select: { id: true, username: true, globalName: true } })).map((u) => [u.id, u.globalName ?? u.username]),
  );
  const name = bot.globalName ?? bot.username;
  const bits = toBits(bot.permissions);
  const isAdmin = has(bits, Permission.Administrator);
  const names = permissionNames(bits);
  const heldRoles = roles.filter((r) => bot.roleIds.includes(r.id));
  const elevations = (bot.channelElevations as unknown as { channelId: string; channelName: string; gained: (keyof typeof PERMISSION_LABELS)[] }[]) ?? [];
  const activeFindings = findings.filter((f) => f.status !== "RESOLVED" && f.severity !== "INFO");
  const permissionEvents = events.items.filter((e) => e.type === "BOT_PERMISSIONS_CHANGED" || e.type === "PERMISSION_ESCALATION");

  return (
    <>
      <Link href={`/dashboard/${guildId}/bots`} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> All bots
      </Link>

      <div className="card mb-4 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <Avatar src={userAvatarUrl(bot.botUserId, bot.avatar, 128)} alt="" fallback={initials(name)} className="size-14" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
            {bot.isIntegris ? <Badge tone="brand">Integris</Badge> : <RiskBadge risk={bot.riskLevel} />}
            <TrustBadge trusted={Boolean(trust)} />
            {!bot.isPresent ? <Badge>Removed {timeAgo(bot.removedAt)}</Badge> : null}
          </div>
          <p className="mt-1 font-mono text-xs text-subtle">
            @{bot.username} · {bot.botUserId}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>Verified bot: {bot.verified === null ? "Unknown" : bot.verified ? "Yes" : "No"}</span>
            <span>Added by: {bot.addedByName ?? bot.addedById ?? "Unknown"}</span>
            <span title={formatDateTime(bot.firstSeenAt)}>First detected {timeAgo(bot.firstSeenAt)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!bot.isIntegris && bot.isPresent ? <TrustControl guildId={guildId} kind="BOT" targetId={bot.botUserId} name={name} trusted={Boolean(trust)} /> : null}
          <Button variant="ghost" asChild>
            <Link href={`/dashboard/${guildId}/settings`}>
              <Bell /> Configure alerts
            </Link>
          </Button>
        </div>
      </div>
      {trust ? (
        <p className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] text-muted">
          Trusted {timeAgo(trust.createdAt)}
          {trust.note ? ` — “${trust.note}”` : ""}. Trust is a local setting, not proof that this bot is safe; Integris still alerts if it gains permissions beyond those approved.
        </p>
      ) : null}
      {bot.isIntegris ? (
        <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-muted">
          This is Integris itself. It requests View Audit Log, View Channels, Send Messages, Embed Links and Manage Webhooks — Discord only lists webhooks to members with Manage Webhooks.
        </p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Security findings</CardTitle>
                <CardDescription>Deterministic rules applied to this bot&apos;s effective permissions. See the docs for every rule.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {findings.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="No findings" description="This bot holds none of the permissions Integris flags." />
              ) : (
                <ul className="space-y-3">
                  {findings.map((f) => (
                    <li key={f.id} className={`rounded-xl border border-border p-4 ${f.status === "RESOLVED" ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <SeverityBadge severity={f.severity} />
                            <StatusBadge status={f.status} />
                          </div>
                          <p className="mt-2 text-sm font-medium">{f.title}</p>
                        </div>
                        <StatusActions guildId={guildId} kind="findings" id={f.id} status={f.status} />
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-muted">{f.description}</p>
                      <Evidence evidence={f.evidence} />
                      <p className="mt-3 text-[13px]">
                        <span className="text-subtle">Recommended: </span>
                        <span className="text-muted">{f.recommendation}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {activeFindings.length === 0 && findings.length > 0 ? <p className="mt-3 text-xs text-muted">All findings are resolved or informational.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Permission changes</CardTitle>
                <CardDescription>Changes to this bot&apos;s effective permissions observed by Integris.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              {permissionEvents.length === 0 ? (
                <p className="py-4 text-sm text-muted">No permission changes recorded.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {permissionEvents.map((e) => {
                    const d = e.details as { gained?: string[]; lost?: string[]; cause?: string };
                    return (
                      <li key={e.id} className="py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span>{e.type === "PERMISSION_ESCALATION" ? "Escalation detected" : "Permissions changed"}</span>
                          <span className="text-xs text-muted" title={formatDateTime(e.occurredAt)}>
                            {timeAgo(e.occurredAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {[
                            d.gained?.length ? <span key="g" className="text-warning">+ {d.gained.join(", ")}</span> : null,
                            d.lost?.length ? <span key="l" className="text-healthy">− {d.lost.join(", ")}</span> : null,
                            d.cause ? <span key="c">{d.cause}</span> : null,
                            <span key="a">Actor: {e.actorName ?? "Unknown"}</span>,
                          ]
                            .filter(Boolean)
                            .flatMap((node, i) => (i ? [<span key={`s${i}`}> · </span>, node] : [node]))}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Bot activity</CardTitle>
                <CardDescription>Security events involving this bot.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-1">{events.items.length ? <EventFeed guildId={guildId} events={events.items} /> : <p className="py-4 text-sm text-muted">No events recorded.</p>}</CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Effective permissions</CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <p className="text-sm text-critical">Administrator — every permission, bypassing channel overwrites.</p>
              ) : names.length === 0 ? (
                <p className="text-sm text-muted">None</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {names
                    .sort((a, b) => Number(DANGEROUS.has(b)) - Number(DANGEROUS.has(a)))
                    .map((n) => (
                      <Badge key={n} tone={DANGEROUS.has(n) ? "warning" : "neutral"}>
                        {PERMISSION_LABELS[n]}
                      </Badge>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Roles & hierarchy</CardTitle>
                <CardDescription>Highest role: {bot.highestRoleName ?? "None"}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {heldRoles.length === 0 ? (
                <p className="text-sm text-muted">Only @everyone.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {heldRoles.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate">
                        <span className="size-2.5 rounded-full" style={{ background: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#5C6479" }} />
                        {r.name}
                        {r.managed ? <Badge>Managed</Badge> : null}
                      </span>
                      <span className="text-xs tabular-nums text-subtle">#{r.position}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Channel overwrites</CardTitle>
                <CardDescription>Channels where overwrites grant sensitive permissions beyond the server-wide set.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {elevations.length === 0 ? (
                <p className="text-sm text-muted">{isAdmin ? "Not applicable — Administrator bypasses overwrites." : "None found."}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {elevations.map((e) => (
                    <li key={e.channelId}>
                      <span className="font-medium">#{e.channelName}</span>
                      <span className="block text-xs text-muted">{e.gained.map((g) => PERMISSION_LABELS[g] ?? g).join(", ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NoteForm guildId={guildId} kind="BOT" targetId={bot.botUserId} />
              {notes.length ? (
                <ul className="space-y-3">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-border bg-background/50 p-3">
                      <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                      <p className="mt-1.5 text-xs text-subtle">
                        {authors.get(n.authorId) ?? n.authorId} · {timeAgo(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
