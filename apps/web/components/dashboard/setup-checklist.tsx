import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SetupStep {
  label: string;
  done: boolean;
  href?: string;
  hint: string;
}

export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <div className="card mb-6 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Finish setting up Integris</h2>
          <p className="mt-1 text-[13px] text-muted">
            {done} of {steps.length} complete
          </p>
        </div>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => {
          const inner = (
            <div className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5", s.done ? "border-border/50 opacity-70" : "border-border bg-surface-2/50")}>
              <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", s.done ? "bg-healthy/15 text-healthy" : "bg-surface-3 text-muted")}>
                {s.done ? <Check className="size-3" /> : i + 1}
              </span>
              <div>
                <p className={cn("text-sm", s.done && "line-through decoration-subtle")}>{s.label}</p>
                <p className="text-xs text-muted">{s.hint}</p>
              </div>
            </div>
          );
          return <li key={s.label}>{s.href && !s.done ? <Link href={s.href}>{inner}</Link> : inner}</li>;
        })}
      </ol>
    </div>
  );
}
