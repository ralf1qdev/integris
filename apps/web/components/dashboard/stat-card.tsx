import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  href?: string;
  tone?: "neutral" | "warning" | "critical" | "healthy";
}) {
  const body = (
    <div className={cn("card h-full p-5 transition-colors", href && "hover:border-border-strong")}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        <Icon
          className={cn(
            "size-4",
            tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : tone === "healthy" ? "text-healthy" : "text-subtle",
          )}
        />
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
