import { MessageFlags } from "discord.js";
import { listBots } from "@integris/database";
import { permissionLabels } from "@integris/security/permissions";
import { RISK_LEVELS, type Severity } from "@integris/shared";
import { env } from "../env";
import { db } from "../runtime";
import { embed, severityTag, truncate } from "../ui";
import { adminCommand } from "./builder";
import type { Command } from "./types";

const DANGEROUS = new Set(["Administrator", "Manage Server", "Manage Roles", "Manage Webhooks", "Manage Channels", "Ban Members", "Kick Members", "Mention @everyone, @here and All Roles"]);

export const bots: Command = {
  data: adminCommand("bots", "Show installed bots and their permission findings").toJSON(),
  async execute(interaction) {
    const [list, trusted] = await Promise.all([
      listBots(db, interaction.guildId),
      db.trustedIntegration.findMany({ where: { guildId: interaction.guildId, kind: "BOT" }, select: { targetId: true } }),
    ]);
    const trustedIds = new Set(trusted.map((t) => t.targetId));
    const rank = (r: string) => RISK_LEVELS.indexOf(r as (typeof RISK_LEVELS)[number]);
    const sorted = [...list].sort((a, b) => rank(b.riskLevel) - rank(a.riskLevel));
    const e = embed(`Bots · ${list.length} detected`);
    if (!list.length) {
      e.description = "No bots in the inventory yet. Run `/scan` to build it.";
    } else {
      e.description = sorted
        .slice(0, 12)
        .map((b) => {
          const name = b.globalName ?? b.username;
          const perms = b.isAdministrator ? ["Administrator"] : permissionLabels(b.permissions).filter((p) => DANGEROUS.has(p));
          const risk = b.isIntegris ? "This is Integris" : b.riskLevel === "NONE" ? "No permission findings" : severityTag(b.riskLevel as Severity);
          return `**${name}**${trustedIds.has(b.botUserId) ? " · Trusted" : ""}\n${risk}${perms.length ? ` · ${truncate(perms.join(", "), 120)}` : ""}`;
        })
        .join("\n\n");
      if (list.length > 12) e.description += `\n\n…and ${list.length - 12} more in the dashboard.`;
    }
    e.fields = [{ name: "Details", value: `${env.APP_URL}/dashboard/${interaction.guildId}/bots` }];
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
  },
};
