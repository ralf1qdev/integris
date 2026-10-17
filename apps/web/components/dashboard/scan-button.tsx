"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client-api";

interface ScanList {
  scans: { id: string; status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED"; error: string | null }[];
}

/** Requests a scan and polls its status until it finishes, then refreshes server data. */
export function ScanButton({ guildId, initiallyRunning = false, label = "Run scan" }: { guildId: string; initiallyRunning?: boolean; label?: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(initiallyRunning);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    let attempts = 0;
    timer.current = setInterval(async () => {
      attempts++;
      try {
        const { scans } = await api<ScanList>(`/api/guilds/${guildId}/scans`);
        const latest = scans[0];
        if (latest && (latest.status === "SUCCEEDED" || latest.status === "FAILED")) {
          setRunning(false);
          if (latest.status === "SUCCEEDED") toast.success(latest.error ? "Scan finished with notices" : "Scan complete", latest.error ? { description: latest.error } : undefined);
          else toast.error("Scan failed", { description: latest.error ?? undefined });
          router.refresh();
        }
      } catch {
        /* transient; keep polling */
      }
      if (attempts > 90) setRunning(false);
    }, 2000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running, guildId, router]);

  async function start() {
    try {
      const r = await api<{ alreadyPending: boolean }>(`/api/guilds/${guildId}/scan`, { method: "POST" });
      toast(r.alreadyPending ? "A scan is already running" : "Scan started", { description: "Inventorying bots, roles, channel overwrites and webhooks." });
      setRunning(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start a scan.");
    }
  }

  return (
    <Button variant="secondary" onClick={start} disabled={running}>
      {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {running ? "Scanning…" : label}
    </Button>
  );
}
