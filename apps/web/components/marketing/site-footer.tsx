import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLUMNS = [
  { title: "Product", links: [["Features", "/features"], ["Pricing", "/pricing"], ["Dashboard", "/dashboard"]] },
  { title: "Resources", links: [["Documentation", "/docs"], ["Security model", "/docs#security-score"], ["Limitations", "/docs#limitations"]] },
  { title: "Trust", links: [["Data & privacy", "/docs#privacy"], ["Permissions", "/docs#permissions"], ["Delete your data", "/docs#data-deletion"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">Security for everything connected to your Discord.</p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="text-xs font-medium uppercase tracking-wider text-subtle">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted transition-colors hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-subtle sm:px-6">
          © {new Date().getFullYear()} Integris. Not affiliated with or endorsed by Discord Inc.
        </p>
      </div>
    </footer>
  );
}
