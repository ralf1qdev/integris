"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client-api";

/** Emergency delete. The administrator must retype the webhook's name to enable the action. */
export function DeleteWebhookDialog({ guildId, webhookId, name, channelName }: { guildId: string; webhookId: string; name: string; channelName: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = confirm === name;

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/guilds/${guildId}/webhooks/${webhookId}`, { method: "DELETE", body: { confirmName: confirm, ...(reason.trim() ? { reason: reason.trim() } : {}) } });
      toast.success(`${name} was deleted`, { description: "The action is recorded in the activity log." });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "The webhook could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirm("");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-critical hover:text-critical" aria-label={`Delete ${name}`}>
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="mb-4 grid size-10 place-items-center rounded-lg border border-critical/30 bg-critical/10">
          <TriangleAlert className="size-5 text-critical" />
        </div>
        <DialogTitle>Delete webhook “{name}”?</DialogTitle>
        <DialogDescription>
          This permanently deletes the webhook in Discord{channelName ? ` from #${channelName}` : ""}. Any service posting through it stops working immediately and its URL can never be used again. This cannot be undone.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="confirm-name">
              Type <span className="font-mono text-foreground">{name}</span> to confirm
            </Label>
            <Input id="confirm-name" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delete-reason">Reason (recorded in Discord&apos;s audit log)</Label>
            <Input id="delete-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Unrecognised webhook in #announcements" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!matches || busy} onClick={remove}>
            Delete webhook
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
