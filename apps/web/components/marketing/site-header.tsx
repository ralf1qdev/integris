import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm text-muted transition-colors hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <a href="/invite">Add to Discord</a>
          </Button>
        </div>
      </div>
      <nav className="flex gap-5 overflow-x-auto border-t border-border/60 px-4 py-2 md:hidden" aria-label="Main mobile">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 text-sm text-muted">
            {n.label}
          </Link>
        ))}
        <Link href="/login" className="shrink-0 text-sm text-muted">
          Sign in
        </Link>
      </nav>
    </header>
  );
}
