import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div>
        <p className="font-mono text-sm text-subtle">404</p>
        <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page may have moved, or the resource no longer exists in this server.</p>
        <Button className="mt-6" variant="secondary" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
