"use client";

import { SEVERITIES, type Severity } from "@integris/shared";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/client-api";

export interface SettingsValues {
  monitoringEnabled: boolean;
  alertChannelId: string | null;
  alertMentionRoleId: string | null;
  alertMinSeverity: Severity;
  alertCooldownMinutes: number;
  alertOnBotJoin: boolean;
  alertOnWebhookCreate: boolean;
  alertOnWebhookDelete: boolean;
  alertOnPermissionEscalation: boolean;
  restrictedChannelIds: string[];
  retentionDays: number;
}

interface Option {
  id: string;
  name: string;
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted">{description}</p>
      </div>
      <div className="shrink-0 sm:w-64 sm:text-right">{children}</div>
    </div>
  );
}

const SEVERITY_TEXT: Record<Severity, string> = { INFO: "Info", LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };

export function SettingsForm({ guildId, initial, channels, roles }: { guildId: string; initial: SettingsValues; channels: Option[]; roles: Option[] }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  const set = <K extends keyof SettingsValues>(k: K, v: SettingsValues[K]) => setValues((s) => ({ ...s, [k]: v }));

  async function save() {
    const patch = Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(initial[k as keyof SettingsValues])));
    setSaving(true);
    try {
      await api(`/api/guilds/${guildId}/settings`, { method: "PATCH", body: patch });
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.fields?.[0] ? `${err.fields[0].path}: ${err.fields[0].message}` : err.message) : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const shownChannels = channels.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <section className="card px-5">
        <h2 className="pt-5 text-sm font-semibold">Monitoring</h2>
        <div className="divide-y divide-border/60">
          <Row title="Monitoring enabled" description="When off, Integris keeps scanning on request but raises no alerts and skips scheduled scans.">
            <Switch checked={values.monitoringEnabled} onCheckedChange={(v) => set("monitoringEnabled", v)} aria-label="Monitoring enabled" />
          </Row>
        </div>
      </section>

      <section className="card px-5">
        <h2 className="pt-5 text-sm font-semibold">Alert delivery</h2>
        <div className="divide-y divide-border/60">
          <Row title="Alert channel" description="Where alerts are posted in Discord. Keep it visible to staff only. Integris needs Send Messages and Embed Links there.">
            <Select aria-label="Alert channel" value={values.alertChannelId ?? ""} onChange={(e) => set("alertChannelId", e.target.value || null)}>
              <option value="">Dashboard only</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </Select>
          </Row>
          <Row title="Minimum severity sent to Discord" description="Every alert is kept in the dashboard; only these are posted.">
            <Select aria-label="Minimum severity" value={values.alertMinSeverity} onChange={(e) => set("alertMinSeverity", e.target.value as Severity)}>
              {SEVERITIES.filter((s) => s !== "INFO").map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_TEXT[s]} and above
                </option>
              ))}
            </Select>
          </Row>
          <Row title="Mention a role" description="Optionally ping a staff role when a new alert is posted.">
            <Select aria-label="Mention role" value={values.alertMentionRoleId ?? ""} onChange={(e) => set("alertMentionRoleId", e.target.value || null)}>
              <option value="">No mention</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </Select>
          </Row>
          <Row title="Repeat cooldown" description="After an alert is resolved, the same unchanged condition will not alert again within this window.">
            <div className="flex items-center gap-2 sm:justify-end">
              <Input
                type="number"
                min={5}
                max={1440}
                className="w-24"
                aria-label="Cooldown in minutes"
                value={values.alertCooldownMinutes}
                onChange={(e) => set("alertCooldownMinutes", Number(e.target.value))}
              />
              <span className="text-sm text-muted">minutes</span>
            </div>
          </Row>
        </div>
      </section>

      <section className="card px-5">
        <h2 className="pt-5 text-sm font-semibold">Alert types</h2>
        <div className="divide-y divide-border/60">
          {(
            [
              ["alertOnBotJoin", "New bot detected", "A bot account joins the server."],
              ["alertOnPermissionEscalation", "Permission escalation", "A bot gains Administrator or another sensitive permission."],
              ["alertOnWebhookCreate", "Unexpected webhook created", "A webhook appears that has not been approved."],
              ["alertOnWebhookDelete", "Webhook deleted", "Protected webhooks always alert on deletion, regardless of this setting."],
            ] as const
          ).map(([key, title, description]) => (
            <Row key={key} title={title} description={description}>
              <Switch checked={values[key]} onCheckedChange={(v) => set(key, v)} aria-label={title} />
            </Row>
          ))}
        </div>
      </section>

      <section className="card px-5 pb-5">
        <h2 className="pt-5 text-sm font-semibold">Restricted channels</h2>
        <p className="mt-1 text-[13px] text-muted">Any webhook in these channels that is not approved is reported as a high-severity finding. Typical choices: announcements, rules, staff channels.</p>
        <Input className="mt-4" placeholder="Filter channels…" aria-label="Filter channels" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="mt-3 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
          {shownChannels.map((c) => {
            const checked = values.restrictedChannelIds.includes(c.id);
            return (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[#5865F2]"
                  checked={checked}
                  onChange={() => set("restrictedChannelIds", checked ? values.restrictedChannelIds.filter((id) => id !== c.id) : [...values.restrictedChannelIds, c.id])}
                />
                <span className="truncate">#{c.name}</span>
              </label>
            );
          })}
          {shownChannels.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted">No channels match.</p> : null}
        </div>
      </section>

      <section className="card px-5">
        <h2 className="pt-5 text-sm font-semibold">Data retention</h2>
        <div className="divide-y divide-border/60">
          <Row title="Keep history for" description="Events, resolved alerts and resolved findings older than this are deleted daily. Open items are always kept.">
            <Select aria-label="Retention" value={String(values.retentionDays)} onChange={(e) => set("retentionDays", Number(e.target.value))}>
              {[7, 30, 90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </Select>
          </Row>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <div className={`card flex items-center gap-3 px-4 py-3 transition-opacity ${dirty ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <span className="text-sm text-muted">Unsaved changes</span>
          <Button variant="ghost" size="sm" onClick={() => setValues(initial)}>
            Discard
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : null} Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
