import { MessageFlags } from "discord.js";
import { createScanJob } from "@integris/database";
import { EMBED_COLORS } from "@integris/shared";
import { db, enqueueScan } from "../runtime";
import { embed } from "../ui";
import { adminCommand } from "./builder";
import type { Command } from "./types";

export const scan: Command = {
  data: adminCommand("scan", "Request a fresh security scan of bots and webhooks").toJSON(),
  async execute(interaction) {
    const r = await createScanJob(db, { guildId: interaction.guildId, trigger: "COMMAND", requestedById: interaction.user.id });
    if (r.status === "cooldown") {
      await interaction.reply({
        embeds: [embed("Scan recently requested", `Please wait ${Math.ceil(r.retryAfterMs / 1000)}s before requesting another scan.`, EMBED_COLORS.warning)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (r.status === "created") await enqueueScan({ guildId: interaction.guildId, scanJobId: r.scan.id, trigger: "COMMAND", requestedById: interaction.user.id });
    await interaction.reply({
      embeds: [
        embed(
          r.status === "created" ? "Scan queued" : "Scan already in progress",
          "Integris is inventorying bots, roles, channel overwrites and webhooks. Results appear in `/security` and the dashboard within a minute for most servers.",
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
