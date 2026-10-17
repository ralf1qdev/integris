import type { SecurityStatus } from "@integris/security/score";

const COLOR: Record<SecurityStatus, string> = { HEALTHY: "#22C55E", NEEDS_ATTENTION: "#F59E0B", AT_RISK: "#EF4444" };

export function ScoreRing({ score, status, size = 132 }: { score: number; status: SecurityStatus; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`Security score ${score} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1C2230" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={COLOR[status]}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{score}</div>
          <div className="text-[11px] uppercase tracking-wider text-subtle">of 100</div>
        </div>
      </div>
    </div>
  );
}
