import { MessageFlags } from "discord.js";
import { listWebhooks } from "@integris/database";
import { WEBHOOK_TYPE_LABELS } from "@integris/shared";
import { env } from "../env";
import { db } from "../runtime";
import { embed, relative } from "../ui";
import { adminCommand } from "./builder";
import type { Command } from "./types";

export const webhooks: Command = {
  data: adminCommand("webhooks", "Show webhook inventory and findings").toJSON(),
  async execute(interaction) {
    const guildId = interaction.guildId;
    const [list, trusted, findings] = await Promise.all([
      listWebhooks(db, guildId),
      db.trustedIntegration.findMany({ where: { guildId, kind: "WEBHOOK" } }),
      db.securityFinding.groupBy({ by: ["targetId"], where: { guildId, targetType: "WEBHOOK", status: "OPEN", severity: { not: "INFO" } }, _count: { _all: true } }),
    ]);
    const trust = new Map(trusted.map((t) => [t.targetId, t]));
    const findingCount = new Map(findings.map((f) => [f.targetId, f._count._all]));
    const e = embed(`Webhooks · ${list.length} active`);
    if (!list.length) {
      e.description = "No webhooks found. If you expected some, make sure Integris has the Manage Webhooks permission and run `/scan`.";
    } else {
      e.description = list
        .slice(0, 15)
        .map((w) => {
          const t = trust.get(w.webhookId);
          const status = t ? (t.protected ? "Trusted · Protected" : "Trusted") : "Not reviewed";
          const n = findingCount.get(w.webhookId);
          return `**${w.name ?? "Unnamed webhook"}** · ${w.channelName ? `#${w.channelName}` : "Unknown channel"}\n${WEBHOOK_TYPE_LABELS[w.type] ?? "Unknown"} · ${status}${n ? ` · ${n} finding(s)` : ""} · seen ${relative(w.firstSeenAt)}`;
        })
        .join("\n\n");
      if (list.length > 15) e.description += `\n\n…and ${list.length - 15} more in the dashboard.`;
    }
    e.fields = [{ name: "Details", value: `${env.APP_URL}/dashboard/${guildId}/webhooks` }];
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
  },
};
