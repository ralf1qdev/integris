/**
 * String-literal enums shared by every app. They mirror the Prisma enums in
 * packages/database/prisma/schema.prisma — keep both in sync.
 */

export const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_RANK: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b];
}

export function maxSeverity(values: Iterable<Severity>): Severity | null {
  let best: Severity | null = null;
  for (const v of values) {
    if (best === null || SEVERITY_RANK[v] > SEVERITY_RANK[best]) best = v;
  }
  return best;
}

export function severityAtLeast(value: Severity, threshold: Severity): boolean {
  return SEVERITY_RANK[value] >= SEVERITY_RANK[threshold];
}

export const RISK_LEVELS = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const FINDING_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const RESOURCE_TYPES = ["BOT", "WEBHOOK", "ROLE", "CHANNEL", "INTEGRATION", "GUILD"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const INTEGRATION_KINDS = ["BOT", "WEBHOOK"] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export const EVENT_SOURCES = ["GATEWAY", "AUDIT_LOG", "RECONCILIATION", "DASHBOARD", "COMMAND", "SYSTEM"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export const AUDIT_EVENT_TYPES = [
  "BOT_ADDED",
  "BOT_REMOVED",
  "BOT_PERMISSIONS_CHANGED",
  "ROLE_PERMISSIONS_CHANGED",
  "PERMISSION_ESCALATION",
  "WEBHOOK_CREATED",
  "WEBHOOK_UPDATED",
  "WEBHOOK_DELETED",
  "WEBHOOK_DELETED_BY_INTEGRIS",
  "INTEGRATION_CREATED",
  "INTEGRATION_UPDATED",
  "INTEGRATION_DELETED",
  "ALERT_ACKNOWLEDGED",
  "ALERT_RESOLVED",
  "ALERT_REOPENED",
  "FINDING_STATUS_CHANGED",
  "TRUST_GRANTED",
  "TRUST_REVOKED",
  "NOTE_ADDED",
  "SETTINGS_UPDATED",
  "SCAN_COMPLETED",
  "SCAN_FAILED",
  "INTEGRIS_INSTALLED",
  "INTEGRIS_REMOVED",
  "DATA_DELETION_REQUESTED",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const SCAN_TRIGGERS = ["INSTALL", "DASHBOARD", "COMMAND", "SCHEDULED", "EVENT"] as const;
export type ScanTrigger = (typeof SCAN_TRIGGERS)[number];

export const SCAN_STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const WEBHOOK_STATUSES = ["ACTIVE", "DELETED"] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

/** Discord webhook types: https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-types */
export const WEBHOOK_TYPE_LABELS: Record<number, string> = {
  1: "Incoming",
  2: "Channel follower",
  3: "Application",
};
