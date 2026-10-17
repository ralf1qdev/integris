import { cn } from "@/lib/utils";

/** Plain <img>: Discord CDN URLs are already sized; next/image would add a proxy hop. */
export function Avatar({ src, alt, fallback, className }: { src: string | null; alt: string; fallback: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-semibold text-muted", className)} aria-label={alt}>
        {fallback.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("size-9 shrink-0 rounded-full bg-surface-3 object-cover", className)} loading="lazy" referrerPolicy="no-referrer" />;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2) || "?";
}
