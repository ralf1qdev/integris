import { getSettings, listChannels, listRoles } from "@integris/database";
import { has, Permission, toBits } from "@integris/security/permissions";
import type { Metadata } from "next";
import { DeleteDataCard } from "@/components/dashboard/delete-data-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { checkGuildAccess } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Settings" };

// Text (0) and announcement (5) channels can receive alerts and hold webhooks.
const MESSAGE_CHANNEL_TYPES = new Set([0, 5]);

export default async function SettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const gate = await checkGuildAccess(guildId);
  if (!gate.ok) return null;

  const [settings, channels, roles] = await Promise.all([getSettings(db, guildId), listChannels(db, guildId), listRoles(db, guildId)]);
  const canDelete = gate.access.isOwner || has(toBits(gate.access.permissions), Permission.Administrator);

  return (
    <>
      <PageHeader title="Settings" description="Configure alert delivery and monitoring for this server. Changes are recorded in the activity log." />
      <SettingsForm
        guildId={guildId}
        initial={{
          monitoringEnabled: settings.monitoringEnabled,
          alertChannelId: settings.alertChannelId,
          alertMentionRoleId: settings.alertMentionRoleId,
          alertMinSeverity: settings.alertMinSeverity,
          alertCooldownMinutes: settings.alertCooldownMinutes,
          alertOnBotJoin: settings.alertOnBotJoin,
          alertOnWebhookCreate: settings.alertOnWebhookCreate,
          alertOnWebhookDelete: settings.alertOnWebhookDelete,
          alertOnPermissionEscalation: settings.alertOnPermissionEscalation,
          restrictedChannelIds: settings.restrictedChannelIds,
          retentionDays: settings.retentionDays,
        }}
        channels={channels.filter((c) => MESSAGE_CHANNEL_TYPES.has(c.type)).map((c) => ({ id: c.id, name: c.name }))}
        roles={roles.filter((r) => r.id !== guildId && !r.managed).map((r) => ({ id: r.id, name: r.name }))}
      />
      <div className="mt-10">
        <DeleteDataCard guildId={guildId} guildName={gate.guild.name} allowed={canDelete} />
      </div>
    </>
  );
}
