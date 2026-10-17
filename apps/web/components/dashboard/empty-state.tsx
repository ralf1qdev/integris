import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid size-11 place-items-center rounded-xl border border-border bg-surface-2">
        <Icon className="size-5 text-muted" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
