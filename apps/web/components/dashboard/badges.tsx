import type { AlertStatus, FindingStatus, RiskLevel, Severity } from "@integris/shared";
import { Badge } from "@/components/ui/badge";

type Tone = "neutral" | "brand" | "healthy" | "warning" | "high" | "critical";

const SEVERITY_TONE: Record<Severity, Tone> = { INFO: "brand", LOW: "neutral", MEDIUM: "warning", HIGH: "high", CRITICAL: "critical" };
const SEVERITY_TEXT: Record<Severity, string> = { INFO: "Info", LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {SEVERITY_TEXT[severity]}
    </Badge>
  );
}

const RISK_TEXT: Record<RiskLevel, string> = { NONE: "No findings", LOW: "Low risk", MEDIUM: "Elevated", HIGH: "High risk", CRITICAL: "Critical" };

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  if (risk === "NONE") return <Badge tone="healthy">{RISK_TEXT.NONE}</Badge>;
  return (
    <Badge tone={SEVERITY_TONE[risk]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {RISK_TEXT[risk]}
    </Badge>
  );
}

const STATUS_TONE: Record<AlertStatus | FindingStatus, Tone> = { OPEN: "critical", ACKNOWLEDGED: "warning", RESOLVED: "healthy" };
const STATUS_TEXT: Record<AlertStatus | FindingStatus, string> = { OPEN: "Open", ACKNOWLEDGED: "Acknowledged", RESOLVED: "Resolved" };

export function StatusBadge({ status }: { status: AlertStatus | FindingStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_TEXT[status]}</Badge>;
}

export function TrustBadge({ trusted, protectedHook }: { trusted: boolean; protectedHook?: boolean }) {
  if (!trusted) return <Badge tone="neutral">Not reviewed</Badge>;
  return <Badge tone="brand">{protectedHook ? "Trusted · Protected" : "Trusted"}</Badge>;
}
