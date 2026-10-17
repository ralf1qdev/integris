import type { ResourceType, Severity } from "@integris/shared";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** A deterministic finding produced by a rule. Persisted as a SecurityFinding. */
export interface FindingDraft {
  ruleId: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  targetType: ResourceType;
  targetId: string;
  targetName: string | null;
  evidence: Record<string, JsonValue>;
}

/** An alert proposed by an event rule. Persisted as a SecurityAlert after dedup. */
export interface AlertDraft {
  dedupKey: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  resourceType: ResourceType;
  resourceId: string | null;
  resourceName: string | null;
  evidence: Record<string, JsonValue>;
}
