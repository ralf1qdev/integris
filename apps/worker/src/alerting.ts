import { raiseAlert, type Db, type GuildSettings } from "@integris/database";
import type { AlertDraft } from "@integris/security";
import { severityAtLeast } from "@integris/shared";
import { enqueueAlertDelivery } from "./queues";
import { log } from "./log";

/**
 * Persists an alert (with dedup/cooldown) and queues Discord delivery when a
 * channel is configured and the severity meets the guild's delivery threshold.
 */
export async function emitAlert(
  db: Db,
  guildId: string,
  settings: GuildSettings,
  draft: AlertDraft,
  findingId?: string | null,
): Promise<void> {
  if (!settings.monitoringEnabled) return;
  const { alert, created } = await raiseAlert(db, guildId, { ...draft, findingId }, { cooldownMinutes: settings.alertCooldownMinutes });
  if (!created) {
    log.debug({ guildId, dedupKey: draft.dedupKey, occurrences: alert.occurrences }, "alert suppressed (duplicate or cooldown)");
    return;
  }
  log.info({ guildId, alertId: alert.id, severity: alert.severity, title: alert.title }, "alert raised");
  if (settings.alertChannelId && severityAtLeast(alert.severity, settings.alertMinSeverity)) {
    await enqueueAlertDelivery(guildId, alert.id);
  }
}
