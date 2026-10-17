"use client";

import { Check, CheckCheck, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client-api";

type Status = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

/** Acknowledge / resolve / reopen controls for alerts and findings. */
export function StatusActions({ guildId, kind, id, status }: { guildId: string; kind: "alerts" | "findings"; id: string; status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: Status) {
    setBusy(true);
    try {
      await api(`/api/guilds/${guildId}/${kind}/${id}`, { method: "PATCH", body: { status: next } });
      toast.success(next === "RESOLVED" ? "Marked as resolved" : next === "ACKNOWLEDGED" ? "Acknowledged" : "Reopened");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "OPEN" ? (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => set("ACKNOWLEDGED")}>
          <Check /> Acknowledge
        </Button>
      ) : null}
      {status !== "RESOLVED" ? (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => set("RESOLVED")}>
          <CheckCheck /> Resolve
        </Button>
      ) : (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => set("OPEN")}>
          <RotateCcw /> Reopen
        </Button>
      )}
    </div>
  );
}
