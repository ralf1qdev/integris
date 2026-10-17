import { setAlertStatus } from "@integris/database";
import { buildAlertMessage, parseAlertButtonId } from "@integris/shared/embeds";
import { EMBED_COLORS } from "@integris/shared";
import { MessageFlags, PermissionFlagsBits, type ButtonInteraction, type Interaction } from "discord.js";
import { commandMap } from "./commands";
import { env } from "./env";
import { db, log } from "./runtime";
import { embed, errorEmbed } from "./ui";

const denied = embed(
  "Manage Server required",
  "Integris security information and actions are limited to members with the Manage Server permission.",
  EMBED_COLORS.warning,
);

async function handleAlertButton(interaction: ButtonInteraction<"cached">) {
  const parsed = parseAlertButtonId(interaction.customId);
  if (!parsed) return;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ embeds: [denied], flags: MessageFlags.Ephemeral });
    return;
  }
  // guildId comes from Discord's interaction, so a button can only act on alerts of the guild it was clicked in.
  const alert = await setAlertStatus(db, {
    guildId: interaction.guildId,
    alertId: parsed.alertId,
    status: parsed.action === "ack" ? "ACKNOWLEDGED" : "RESOLVED",
    actorId: interaction.user.id,
    actorName: interaction.user.username,
    source: "COMMAND",
  });
  if (!alert) {
    await interaction.reply({ embeds: [errorEmbed("This alert no longer exists.")], flags: MessageFlags.Ephemeral });
    return;
  }
  const message = buildAlertMessage(alert, env.APP_URL);
  await interaction.update({ embeds: message.embeds, components: message.components });
}

export async function handleInteraction(interaction: Interaction) {
  if (!interaction.inCachedGuild()) {
    if (interaction.isRepliable()) await interaction.reply({ content: "Integris commands only work inside a server.", flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (!command) return;
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ embeds: [denied], flags: MessageFlags.Ephemeral });
        return;
      }
      const guild = await db.guild.findUnique({ where: { id: interaction.guildId }, select: { botPresent: true } });
      if (!guild?.botPresent) {
        await interaction.reply({ embeds: [errorEmbed("Integris is still registering this server. Try again in a few seconds.")], flags: MessageFlags.Ephemeral });
        return;
      }
      await command.execute(interaction);
      log.info({ guildId: interaction.guildId, userId: interaction.user.id, command: interaction.commandName }, "command executed");
      return;
    }
    if (interaction.isButton()) await handleAlertButton(interaction);
  } catch (err) {
    log.error({ err, guildId: interaction.guildId }, "interaction failed");
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ embeds: [errorEmbed("Integris could not complete that request. Please try again.")], flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}
