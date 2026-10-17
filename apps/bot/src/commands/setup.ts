import { createScanJob, getSettings, updateSettings } from "@integris/database";
import { SEVERITIES, EMBED_COLORS, type Severity } from "@integris/shared";
import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { env } from "../env";
import { db, enqueueScan } from "../runtime";
import { embed, SEVERITY_LABEL } from "../ui";
import { adminCommand } from "./builder";
import type { Command } from "./types";

const REQUIRED = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];

export const setup: Command = {
  data: adminCommand("setup", "Choose where Integris sends security alerts")
    .addChannelOption((o) =>
      o.setName("channel").setDescription("Channel for security alerts (keep it private to staff)").addChannelTypes(ChannelType.GuildText).setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("min_severity")
        .setDescription("Lowest severity sent to Discord (default: Medium)")
        .addChoices(...SEVERITIES.filter((s) => s !== "INFO").map((s) => ({ name: SEVERITY_LABEL[s], value: s }))),
    )
    .addRoleOption((o) => o.setName("mention_role").setDescription("Optional role to mention on new alerts"))
    .toJSON(),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.options.getChannel("channel", true, [ChannelType.GuildText]);
    const me = interaction.guild.members.me;
    const perms = me ? channel.permissionsFor(me) : null;
    if (!perms || !REQUIRED.every((p) => perms.has(p))) {
      await interaction.editReply({
        embeds: [embed("Missing channel permissions", `Integris needs **View Channel**, **Send Messages** and **Embed Links** in ${channel}. Update the channel's permissions and run \`/setup\` again.`, EMBED_COLORS.warning)],
      });
      return;
    }
    const minSeverity = (interaction.options.getString("min_severity") as Severity | null) ?? undefined;
    const role = interaction.options.getRole("mention_role");
    if (role && (role.id === interaction.guildId || role.managed)) {
      await interaction.editReply({ embeds: [embed("Choose another role", "Pick a regular staff role. @everyone and bot roles cannot be mentioned.", EMBED_COLORS.warning)] });
      return;
    }

    // The channel may be newer than the last scan snapshot.
    await db.guildChannel.upsert({
      where: { id: channel.id },
      create: { id: channel.id, guildId: interaction.guildId, name: channel.name, type: channel.type, position: channel.position },
      update: { name: channel.name, guildId: interaction.guildId },
    });
    const result = await updateSettings(
      db,
      interaction.guildId,
      { alertChannelId: channel.id, ...(minSeverity ? { alertMinSeverity: minSeverity } : {}), ...(role ? { alertMentionRoleId: role.id } : {}) },
      { id: interaction.user.id, name: interaction.user.username, source: "COMMAND" },
    );
    if ("error" in result) {
      await interaction.editReply({ embeds: [embed("Could not save settings", "That channel is not part of this server.", EMBED_COLORS.critical)] });
      return;
    }

    await channel.send({
      embeds: [embed("Integris alerts will appear here", `Configured by ${interaction.user}. Alerts at **${SEVERITY_LABEL[result.alertMinSeverity]}** severity or higher are delivered to this channel.`)],
      allowedMentions: { parse: [] },
    });

    const guild = await db.guild.findUnique({ where: { id: interaction.guildId } });
    if (!guild?.lastSyncAt) {
      const scan = await createScanJob(db, { guildId: interaction.guildId, trigger: "COMMAND", requestedById: interaction.user.id });
      if (scan.status === "created") await enqueueScan({ guildId: interaction.guildId, scanJobId: scan.scan.id, trigger: "COMMAND", requestedById: interaction.user.id });
    }
    const settings = await getSettings(db, interaction.guildId);
    await interaction.editReply({
      embeds: [
        embed(
          "Setup complete",
          `Alerts go to ${channel} at **${SEVERITY_LABEL[settings.alertMinSeverity]}** or higher${settings.alertMentionRoleId ? `, mentioning <@&${settings.alertMentionRoleId}>` : ""}. Monitoring is ${settings.monitoringEnabled ? "on" : "off"}.\n\nFine-tune alerts and restricted channels in the dashboard:\n${env.APP_URL}/dashboard/${interaction.guildId}/settings`,
          EMBED_COLORS.healthy,
        ),
      ],
    });
  },
};
