import type { AuditEvent } from "@integris/database";
import {
  Bot,
  BotOff,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Link2,
  Link2Off,
  type LucideIcon,
  Pencil,
  ScanSearch,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<AuditEvent["type"], LucideIcon>> = {
  BOT_ADDED: Bot,
  BOT_REMOVED: BotOff,
  BOT_PERMISSIONS_CHANGED: KeyRound,
  ROLE_PERMISSIONS_CHANGED: KeyRound,
  PERMISSION_ESCALATION: TriangleAlert,
  WEBHOOK_CREATED: Link2,
  WEBHOOK_UPDATED: Pencil,
  WEBHOOK_DELETED: Link2Off,
  WEBHOOK_DELETED_BY_INTEGRIS: Trash2,
  ALERT_ACKNOWLEDGED: CircleAlert,
  ALERT_RESOLVED: CheckCircle2,
  TRUST_GRANTED: ShieldCheck,
  TRUST_REVOKED: ShieldAlert,
  NOTE_ADDED: StickyNote,
  SETTINGS_UPDATED: Settings2,
  SCAN_COMPLETED: ScanSearch,
};

const SOURCE: Record<AuditEvent["source"], string> = {
  GATEWAY: "Live event",
  AUDIT_LOG: "Audit log",
  RECONCILIATION: "Scan",
  DASHBOARD: "Dashboard",
  COMMAND: "Discord",
  SYSTEM: "System",
};

function hrefFor(guildId: string, e: AuditEvent): string | null {
  if (e.targetType === "BOT" && e.targetId) return `/dashboard/${guildId}/bots/${e.targetId}`;
  if (e.targetType === "WEBHOOK") return `/dashboard/${guildId}/webhooks`;
  return null;
}

export function EventFeed({ guildId, events, compact = false }: { guildId: string; events: AuditEvent[]; compact?: boolean }) {
  return (
    <ol className="relative">
      {events.map((e) => {
        const Icon = ICONS[e.type] ?? CircleAlert;
        const href = hrefFor(guildId, e);
        const tone =
          e.severity === "CRITICAL" || e.severity === "HIGH" ? "text-critical bg-critical/10 border-critical/20" : e.severity === "MEDIUM" ? "text-warning bg-warning/10 border-warning/20" : "text-muted bg-surface-2 border-border";
        const content = (
          <div className="flex gap-3 py-3">
            <div className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border", tone)}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{e.summary}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                <time dateTime={e.occurredAt.toISOString()} title={formatDateTime(e.occurredAt)}>
                  {timeAgo(e.occurredAt)}
                </time>
                <span aria-hidden>·</span>
                <span>{SOURCE[e.source]}</span>
                {!compact ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>Actor: {e.actorName ?? (e.actorId ? e.actorId : "Unknown")}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        );
        return (
          <li key={e.id} className="border-b border-border/60 last:border-0">
            {href ? (
              <Link href={href} className="-mx-2 block rounded-lg px-2 transition-colors hover:bg-surface-2/60">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
