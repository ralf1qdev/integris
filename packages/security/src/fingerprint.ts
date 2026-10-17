import { createHash } from "node:crypto";

/** Stable JSON: object keys sorted so equal evidence always hashes equally. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Identity of a finding: one rule, one resource. Independent of evidence. */
export function findingFingerprint(ruleId: string, targetType: string, targetId: string): string {
  return sha256(`${ruleId}|${targetType}|${targetId}`).slice(0, 40);
}

export function evidenceHash(evidence: unknown): string {
  return sha256(stableStringify(evidence)).slice(0, 40);
}
