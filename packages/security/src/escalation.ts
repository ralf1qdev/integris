import type { Severity } from "@integris/shared";
import { DANGEROUS_PERMISSIONS, label } from "./dangerous";
import { diffPermissions, has, Permission, toBits, type PermissionName } from "./permissions";
import type { AlertDraft } from "./types";

export interface EscalationResult {
  gained: PermissionName[];
  lost: PermissionName[];
  dangerousGained: PermissionName[];
}

export function analyseEscalation(before: bigint | string, after: bigint | string): EscalationResult {
  const b = toBits(before);
  const a = toBits(after);
  // Administrator implies everything: report it once rather than every implied bit.
  if (!has(b, Permission.Administrator) && has(a, Permission.Administrator)) {
    return { gained: ["Administrator"], lost: [], dangerousGained: ["Administrator"] };
  }
  const diff = diffPermissions(b, a);
  const dangerous = new Set(DANGEROUS_PERMISSIONS.map((d) => d.name));
  return { ...diff, dangerousGained: diff.gained.filter((g) => dangerous.has(g)) };
}

/**
 * Alert for a bot whose effective permissions gained dangerous capabilities.
 * Trusted bots still alert, one severity step lower: trust is not proof of safety.
 */
export function botEscalationAlert(input: {
  botId: string;
  botName: string;
  before: bigint | string;
  after: bigint | string;
  trusted: boolean;
  cause: string;
}): AlertDraft | null {
  const r = analyseEscalation(input.before, input.after);
  if (!r.dangerousGained.length) return null;
  const toAdmin = r.dangerousGained.includes("Administrator");
  let severity: Severity = toAdmin ? "CRITICAL" : "HIGH";
  if (input.trusted) severity = toAdmin ? "HIGH" : "MEDIUM";
  const labels = r.dangerousGained.map(label);
  return {
    dedupKey: `escalation:${input.botId}:${toBits(input.after).toString()}`,
    severity,
    title: "Suspicious permission escalation",
    description: `${input.botName} gained ${labels.join(", ")}. ${input.cause}`,
    recommendation:
      "Confirm this change was intentional. If not, revert the role change in Server Settings → Roles and review who made it in the audit log.",
    resourceType: "BOT",
    resourceId: input.botId,
    resourceName: input.botName,
    evidence: {
      gained: labels,
      lost: r.lost.map(label),
      trusted: input.trusted,
      cause: input.cause,
    },
  };
}
