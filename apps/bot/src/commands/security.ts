import { MessageFlags } from "discord.js";
import { getGuildOverview } from "@integris/database";
import { SECURITY_STATUS_LABEL } from "@integris/security/score";
import { EMBED_COLORS } from "@integris/shared";
import { env } from "../env";
import { db } from "../runtime";
import { embed, relative, severityTag } from "../ui";
import { adminCommand } from "./builder";
import type { Command } from "./types";

const STATUS_COLOR = { HEALTHY: EMBED_COLORS.healthy, NEEDS_ATTENTION: EMBED_COLORS.warning, AT_RISK: EMBED_COLORS.critical } as const;

export const security: Command = {
  data: adminCommand("security", "Show this server's integration security status").toJSON(),
  async execute(interaction) {
    const guild = await db.guild.findUnique({ where: { id: interaction.guildId } });
    const o = await getGuildOverview(db, interaction.guildId);
    const e = embed(
      `Security status · ${SECURITY_STATUS_LABEL[o.score.status]}`,
      guild?.lastSyncAt
        ? `Security score **${o.score.score}/100**. The score is calculated from open findings using documented, fixed weights.`
        : "Integris has not completed its first scan yet. Run `/scan` or wait a moment.",
      STATUS_COLOR[o.score.status],
    );
    e.fields = [
      { name: "Bots", value: `${o.botCount}${o.adminBots ? ` · ${o.adminBots} with Administrator` : ""}`, inline: true },
      { name: "Webhooks", value: String(o.webhookCount), inline: true },
      { name: "Active alerts", value: String(o.activeAlerts), inline: true },
      { name: "Last sync", value: relative(guild?.lastSyncAt), inline: true },
      { name: "Alert channel", value: o.alertChannelConfigured ? "Configured" : "Not set — use `/setup`", inline: true },
    ];
    if (o.permissionRisks.length) {
      e.fields.push({
        name: "Top permission risks",
        value: o.permissionRisks.map((r) => `${severityTag(r.severity)} · **${r.targetName ?? r.targetId}** — ${r.title}`).join("\n").slice(0, 1024),
      });
    }
    if (guild?.lastSyncError) e.fields.push({ name: "Scan notice", value: guild.lastSyncError.slice(0, 1024) });
    e.fields.push({ name: "Dashboard", value: `${env.APP_URL}/dashboard/${interaction.guildId}` });
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
  },
};
