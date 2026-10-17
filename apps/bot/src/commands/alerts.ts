import { MessageFlags } from "discord.js";
import { listAlerts } from "@integris/database";
import { env } from "../env";
import { db } from "../runtime";
import { embed, relative, severityTag, truncate } from "../ui";
import { adminCommand } from "./builder";
import type { Command } from "./types";

export const alerts: Command = {
  data: adminCommand("alerts", "Show active security alerts").toJSON(),
  async execute(interaction) {
    const { items } = await listAlerts(db, interaction.guildId, { status: ["OPEN", "ACKNOWLEDGED"], limit: 10 });
    const e = embed(`Active alerts · ${items.length}${items.length === 10 ? "+" : ""}`);
    e.description = items.length
      ? items
          .map((a) => `${severityTag(a.severity)} · **${truncate(a.title, 80)}**${a.status === "ACKNOWLEDGED" ? " · Acknowledged" : ""}\n${truncate(a.resourceName ?? a.resourceId ?? "Unknown", 60)} · ${relative(a.createdAt)}`)
          .join("\n\n")
      : "No active alerts. Integris will notify your alert channel when something changes.";
    e.fields = [{ name: "Manage alerts", value: `${env.APP_URL}/dashboard/${interaction.guildId}/alerts` }];
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
  },
};
