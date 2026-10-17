"use client";

import { ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GuildError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <ServerCrash className="mx-auto size-6 text-critical" />
      <h2 className="mt-4 font-semibold">This page failed to load</h2>
      <p className="mt-2 text-sm text-muted">The error has been logged. Your server data is unaffected.</p>
      <Button className="mt-6" variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
