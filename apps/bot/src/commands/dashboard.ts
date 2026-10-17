import { MessageFlags } from "discord.js";
import { env } from "../env";
import { embed } from "../ui";
import { adminCommand } from "./builder";
import type { Command } from "./types";

export const dashboard: Command = {
  data: adminCommand("dashboard", "Get the link to this server's Integris dashboard").toJSON(),
  async execute(interaction) {
    await interaction.reply({
      embeds: [embed("Integris dashboard", `${env.APP_URL}/dashboard/${interaction.guildId}\n\nSign in with Discord. Access requires Manage Server in this server.`)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
