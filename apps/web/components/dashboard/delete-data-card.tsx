"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/client-api";

export function DeleteDataCard({ guildId, guildName, allowed }: { guildId: string; guildName: string; allowed: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [leave, setLeave] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api(`/api/guilds/${guildId}/data`, { method: "DELETE", body: { confirmGuildName: confirm, leaveGuild: leave } });
      toast.success("Deletion started", { description: "All Integris data for this server will be erased within a minute." });
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Deletion could not be started.");
      setBusy(false);
    }
  }

  return (
    <section className="card border-critical/25 p-5">
      <h2 className="text-sm font-semibold text-critical">Delete all Integris data</h2>
      <p className="mt-1 max-w-xl text-[13px] text-muted">
        Permanently erases the inventory, findings, alerts, events, notes and settings Integris stores for this server. A minimal record of the deletion request is kept. Nothing in Discord itself is changed.
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="danger" className="mt-4" disabled={!allowed}>
            Delete server data
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Delete all data for {guildName}?</DialogTitle>
          <DialogDescription>This cannot be undone. Monitoring stops if Integris leaves the server.</DialogDescription>
          <div className="mt-5 space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <span className="text-sm">Remove Integris from the server too</span>
              <Switch checked={leave} onCheckedChange={setLeave} aria-label="Remove Integris from the server" />
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-guild">
                Type <span className="font-mono text-foreground">{guildName}</span> to confirm
              </Label>
              <Input id="confirm-guild" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="danger" disabled={confirm !== guildName || busy} onClick={submit}>
              Permanently delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {!allowed ? <p className="mt-2 text-xs text-subtle">Only the server owner or an Administrator can do this.</p> : null}
    </section>
  );
}
