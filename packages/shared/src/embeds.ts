import { EMBED_COLORS } from "./brand";
import type { AlertStatus, ResourceType, Severity } from "./enums";
import { redactObject, redactSecrets } from "./redact";

/**
 * Discord message builders shared by the worker (alert delivery) and the bot
 * (commands, button updates). Output is raw Discord API JSON.
 */

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Embed {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

export interface ButtonComponent {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5;
  label: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
}

export interface ActionRow {
  type: 1;
  components: ButtonComponent[];
}

export interface MessagePayload {
  content?: string;
  embeds: Embed[];
  components: ActionRow[];
  allowed_mentions: { parse: never[]; roles?: string[] };
}

export const SEVERITY_COLOR: Record<Severity, number> = {
  INFO: EMBED_COLORS.info,
  LOW: EMBED_COLORS.low,
  MEDIUM: EMBED_COLORS.warning,
  HIGH: EMBED_COLORS.high,
  CRITICAL: EMBED_COLORS.critical,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  INFO: "Info",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const STATUS_LABEL: Record<AlertStatus, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
};

export const FOOTER = "Integris · Security for everything connected to your Discord";

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export const ALERT_BUTTON_PREFIX = "integris:alert";

export function alertButtonId(action: "ack" | "resolve", alertId: string): string {
  return `${ALERT_BUTTON_PREFIX}:${action}:${alertId}`;
}

export function parseAlertButtonId(customId: string): { action: "ack" | "resolve"; alertId: string } | null {
  const m = /^integris:alert:(ack|resolve):([a-z0-9]{10,40})$/i.exec(customId);
  if (!m) return null;
  return { action: m[1] as "ack" | "resolve", alertId: m[2]! };
}

export interface AlertMessageInput {
  id: string;
  guildId: string;
  severity: Severity;
  title: string;
  description: string;
  resourceType: ResourceType;
  resourceId: string | null;
  resourceName: string | null;
  recommendation: string;
  status: AlertStatus;
  evidence: unknown;
  createdAt: Date | string;
  occurrences: number;
  acknowledgedById?: string | null;
  resolvedById?: string | null;
}

function formatEvidenceValue(v: unknown): string {
  if (v === null || v === undefined) return "Unknown";
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(", ") : "None";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function humanizeKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export function buildAlertMessage(alert: AlertMessageInput, appUrl: string, mentionRoleId?: string | null): MessagePayload {
  const resource = alert.resourceName
    ? `${alert.resourceName}${alert.resourceId ? ` (\`${alert.resourceId}\`)` : ""}`
    : alert.resourceId
      ? `\`${alert.resourceId}\``
      : "Unknown";

  const evidence = redactObject(alert.evidence);
  const evidenceLines =
    evidence && typeof evidence === "object" && !Array.isArray(evidence)
      ? Object.entries(evidence as Record<string, unknown>)
          .slice(0, 8)
          .map(([k, v]) => `**${humanizeKey(k)}:** ${truncate(formatEvidenceValue(v), 180)}`)
      : [];

  let statusText = STATUS_LABEL[alert.status];
  if (alert.status === "ACKNOWLEDGED" && alert.acknowledgedById) statusText += ` by <@${alert.acknowledgedById}>`;
  if (alert.status === "RESOLVED" && alert.resolvedById) statusText += ` by <@${alert.resolvedById}>`;

  const fields: EmbedField[] = [
    { name: "Severity", value: SEVERITY_LABEL[alert.severity], inline: true },
    { name: "Status", value: statusText, inline: true },
    { name: "Resource", value: truncate(`${humanizeKey(alert.resourceType.toLowerCase())}: ${resource}`, 1024), inline: false },
  ];
  if (evidenceLines.length) fields.push({ name: "Evidence", value: truncate(evidenceLines.join("\n"), 1024) });
  fields.push({ name: "Recommended response", value: truncate(alert.recommendation, 1024) });
  if (alert.occurrences > 1) fields.push({ name: "Occurrences", value: String(alert.occurrences), inline: true });

  const link = `${appUrl}/dashboard/${alert.guildId}/alerts?alert=${alert.id}`;
  const buttons: ButtonComponent[] = [];
  if (alert.status === "OPEN") {
    buttons.push({ type: 2, style: 2, label: "Acknowledge", custom_id: alertButtonId("ack", alert.id) });
  }
  if (alert.status !== "RESOLVED") {
    buttons.push({ type: 2, style: 3, label: "Resolve", custom_id: alertButtonId("resolve", alert.id) });
  }
  buttons.push({ type: 2, style: 5, label: "Open in dashboard", url: link });

  return {
    content: mentionRoleId && alert.status === "OPEN" ? `<@&${mentionRoleId}>` : undefined,
    embeds: [
      {
        title: truncate(alert.title, 256),
        description: truncate(redactSecrets(alert.description), 2000),
        color: alert.status === "RESOLVED" ? EMBED_COLORS.resolved : SEVERITY_COLOR[alert.severity],
        fields,
        footer: { text: FOOTER },
        timestamp: new Date(alert.createdAt).toISOString(),
      },
    ],
    components: [{ type: 1, components: buttons }],
    allowed_mentions: { parse: [], roles: mentionRoleId ? [mentionRoleId] : [] },
  };
}
