import type { FindingStatus, Severity } from "@integris/shared";

/**
 * Security score — fully deterministic and documented in docs/SECURITY_MODEL.md.
 *
 *   score = max(0, round(100 − Σ weight(severity) × statusFactor))
 *
 *   weight:       CRITICAL 25 · HIGH 10 · MEDIUM 4 · LOW 1 · INFO 0
 *   statusFactor: OPEN 1 · ACKNOWLEDGED 0.5 (accepted risk) · RESOLVED 0
 *
 *   status: AT_RISK          if any open CRITICAL finding, or score < 50
 *           NEEDS_ATTENTION  if any open HIGH finding, or score < 80
 *           HEALTHY          otherwise
 */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 25,
  HIGH: 10,
  MEDIUM: 4,
  LOW: 1,
  INFO: 0,
};

export const STATUS_FACTOR: Record<FindingStatus, number> = {
  OPEN: 1,
  ACKNOWLEDGED: 0.5,
  RESOLVED: 0,
};

export type SecurityStatus = "HEALTHY" | "NEEDS_ATTENTION" | "AT_RISK";

export interface ScoreInput {
  severity: Severity;
  status: FindingStatus;
}

export interface SecurityScore {
  score: number;
  status: SecurityStatus;
  deductions: Record<Severity, number>;
  counts: Record<Severity, number>;
}

export function computeSecurityScore(findings: readonly ScoreInput[]): SecurityScore {
  const deductions: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  let openCritical = false;
  let openHigh = false;

  for (const f of findings) {
    if (f.status === "RESOLVED") continue;
    counts[f.severity] += 1;
    deductions[f.severity] += SEVERITY_WEIGHT[f.severity] * STATUS_FACTOR[f.status];
    if (f.status === "OPEN" && f.severity === "CRITICAL") openCritical = true;
    if (f.status === "OPEN" && f.severity === "HIGH") openHigh = true;
  }

  const total = Object.values(deductions).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.round(100 - total));
  const status: SecurityStatus =
    openCritical || score < 50 ? "AT_RISK" : openHigh || score < 80 ? "NEEDS_ATTENTION" : "HEALTHY";
  return { score, status, deductions, counts };
}

export const SECURITY_STATUS_LABEL: Record<SecurityStatus, string> = {
  HEALTHY: "Healthy",
  NEEDS_ATTENTION: "Needs attention",
  AT_RISK: "At risk",
};
