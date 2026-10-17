import Link from "next/link";
import { cn } from "@/lib/utils";

/** Integris mark: a shield built from two interlocking links. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("size-7", className)} aria-hidden>
      <path d="M16 2.5 4.5 7v8.2c0 6.9 4.8 12.4 11.5 14.3 6.7-1.9 11.5-7.4 11.5-14.3V7L16 2.5Z" fill="#5865F2" />
      <path d="M16 2.5 4.5 7v8.2c0 6.9 4.8 12.4 11.5 14.3V2.5Z" fill="#818CF8" fillOpacity=".35" />
      <rect x="10.5" y="10.5" width="7" height="7" rx="2.2" stroke="#fff" strokeWidth="1.8" />
      <rect x="14.5" y="14.5" width="7" height="7" rx="2.2" stroke="#fff" strokeWidth="1.8" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight text-foreground", className)}>
      <LogoMark />
      <span className="text-[17px]">Integris</span>
    </Link>
  );
}
