import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "border-border bg-surface-2 text-muted",
      brand: "border-primary/30 bg-primary/10 text-secondary",
      healthy: "border-healthy/25 bg-healthy/10 text-healthy",
      warning: "border-warning/25 bg-warning/10 text-warning",
      high: "border-high/25 bg-high/10 text-high",
      critical: "border-critical/30 bg-critical/10 text-critical",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
