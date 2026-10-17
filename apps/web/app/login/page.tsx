import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/redirects";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  denied: "You cancelled the Discord authorization. Sign in again whenever you're ready.",
  state: "Your sign-in link expired or was opened in another browser. Please try again.",
  scope: "Integris needs both the identify and guilds scopes to verify which servers you manage.",
  expired: "Discord rejected the sign-in code. Please try again.",
  oauth: "Discord sign-in failed. Please try again in a moment.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSession()) redirect(next);
  const error = sp.error ? (ERRORS[sp.error] ?? ERRORS.oauth) : null;

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="grid-fade pointer-events-none fixed inset-0" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-7">
          <h1 className="text-lg font-semibold tracking-tight">Sign in to Integris</h1>
          <p className="mt-1.5 text-sm text-muted">Use your Discord account to open the security dashboard.</p>
          {error ? <p className="mt-4 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-[13px] text-critical">{error}</p> : null}
          <Button className="mt-6 w-full" size="lg" asChild>
            <a href={`/api/auth/login?next=${encodeURIComponent(next)}`}>Continue with Discord</a>
          </Button>
          <div className="mt-6 space-y-2 border-t border-border pt-5 text-xs text-muted">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-3.5 text-healthy" /> What Integris requests
            </p>
            <p>
              <span className="text-foreground">identify</span> — your username and avatar.
            </p>
            <p>
              <span className="text-foreground">guilds</span> — the servers you are in and your permissions there, to verify you can manage them.
            </p>
            <p>Integris cannot read your messages, join servers for you, or act on your behalf.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
