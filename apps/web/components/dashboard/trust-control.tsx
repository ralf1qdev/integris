"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/client-api";

export function TrustControl({
  guildId,
  kind,
  targetId,
  name,
  trusted,
  isProtected = false,
  size = "md",
}: {
  guildId: string;
  kind: "BOT" | "WEBHOOK";
  targetId: string;
  name: string;
  trusted: boolean;
  isProtected?: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [protect, setProtect] = useState(isProtected || kind === "WEBHOOK");
  const [busy, setBusy] = useState(false);
  const path = `/api/guilds/${guildId}/${kind === "BOT" ? "bots" : "webhooks"}/${targetId}/trust`;

  async function submit(nextTrusted: boolean) {
    setBusy(true);
    try {
      await api(path, { method: "PUT", body: { trusted: nextTrusted, ...(kind === "WEBHOOK" ? { protected: protect } : {}), ...(note.trim() ? { note: note.trim() } : {}) } });
      toast.success(nextTrusted ? `${name} marked as trusted` : `Trust removed from ${name}`);
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update trust.");
    } finally {
      setBusy(false);
    }
  }

  if (trusted) {
    return (
      <Button size={size} variant="ghost" onClick={() => submit(false)} disabled={busy}>
        <ShieldOff /> Remove trust
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="secondary">
          <ShieldCheck /> {kind === "BOT" ? "Mark trusted" : "Approve"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{kind === "BOT" ? `Trust ${name}?` : `Approve ${name}?`}</DialogTitle>
        <DialogDescription>
          Trust is a local decision for this server, not proof that an integration is safe.{" "}
          {kind === "BOT"
            ? "Integris will stop sending finding alerts for this bot, but it will still alert if the bot gains permissions beyond what it has today."
            : "Integris stops flagging this webhook as unreviewed. Protected webhooks raise a high-severity alert if they are modified or deleted."}
        </DialogDescription>
        <div className="mt-5 space-y-4">
          {kind === "WEBHOOK" ? (
            <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <span>
                <span className="block text-sm font-medium">Protect this webhook</span>
                <span className="block text-xs text-muted">Alert when its name, avatar or channel changes, or it is deleted.</span>
              </span>
              <Switch checked={protect} onCheckedChange={setProtect} aria-label="Protect webhook" />
            </label>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="trust-note">Reason (optional)</Label>
            <Textarea id="trust-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Official moderation bot, reviewed by the staff team" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => submit(true)} disabled={busy}>
            {kind === "BOT" ? "Mark trusted" : "Approve webhook"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
