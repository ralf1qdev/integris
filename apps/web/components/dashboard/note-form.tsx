"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client-api";

export function NoteForm({ guildId, kind, targetId }: { guildId: string; kind: "BOT" | "WEBHOOK"; targetId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api(`/api/guilds/${guildId}/notes`, { method: "POST", body: { kind, targetId, body: body.trim() } });
      setBody("");
      toast.success("Note added");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea aria-label="New note" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} placeholder="Add context for other administrators…" />
      <div className="flex justify-end">
        <Button size="sm" type="submit" disabled={busy || !body.trim()}>
          Add note
        </Button>
      </div>
    </form>
  );
}
