import { attachTicketThread, closeTicket, discardTicket, findOpenTicket, getTicketByThread, reserveTicket } from "@integris/database";
import { EMBED_COLORS } from "@integris/shared";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { isTicketCategory, TICKET_CATEGORIES, type TicketCategory } from "../config";
import { canCloseTicket, formatDuration, ticketThreadName } from "../helpers";
import { db, log } from "../runtime";
import type { Server } from "../server";

export const TICKET_PREFIX = "ticket:";

/** Buttons shown under the #help panel. */
export function panelComponents() {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const [key, c] of Object.entries(TICKET_CATEGORIES)) {
    row.addComponents(new ButtonBuilder().setCustomId(`${TICKET_PREFIX}open:${key}`).setLabel(c.label).setEmoji(c.emoji).setStyle(key === "security" ? ButtonStyle.Danger : ButtonStyle.Secondary));
  }
  return [row.toJSON()];
}

function closeRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`${TICKET_PREFIX}close`).setLabel("Close ticket").setEmoji("🔒").setStyle(ButtonStyle.Secondary)).toJSON();
}

async function showModal(interaction: ButtonInteraction<"cached">, category: TicketCategory) {
  const modal = new ModalBuilder()
    .setCustomId(`${TICKET_PREFIX}submit:${category}`)
    .setTitle(TICKET_CATEGORIES[category].label)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("subject").setLabel("Subject").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("details")
          .setLabel("Details")
          .setPlaceholder("What happened, what you expected, your server ID if relevant. Never paste tokens or webhook URLs.")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1500)
          .setRequired(true),
      ),
    );
  await interaction.showModal(modal);
}

async function openTicket(server: Server, interaction: ModalSubmitInteraction<"cached">, category: TicketCategory) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const help = server.channel("help");
  if (!help) {
    await interaction.editReply("Tickets are unavailable right now. Please contact a moderator.");
    return;
  }
  const existing = await findOpenTicket(db, server.guild.id, interaction.user.id);
  if (existing) {
    await interaction.editReply(`You already have an open ticket: <#${existing.threadId}>`);
    return;
  }

  const subject = interaction.fields.getTextInputValue("subject").trim();
  const details = interaction.fields.getTextInputValue("details").trim();
  const ticket = await reserveTicket(db, { guildId: server.guild.id, openerId: interaction.user.id, openerName: interaction.user.username, category, subject });

  try {
    const thread = await help.threads.create({
      name: ticketThreadName(ticket.number, interaction.user.username),
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: 10080,
      reason: `Ticket #${ticket.number} opened by ${interaction.user.tag}`,
    });
    await attachTicketThread(db, ticket.id, thread.id);
    await thread.members.add(interaction.user.id);

    const meta = TICKET_CATEGORIES[category];
    const staff = server.role(meta.staff);
    await thread.send({
      content: `${interaction.user}${staff ? ` ${staff}` : ""}`,
      embeds: [
        {
          color: category === "security" ? EMBED_COLORS.critical : EMBED_COLORS.brand,
          title: `${meta.emoji} Ticket #${ticket.number} · ${subject}`,
          description: details,
          fields: [
            { name: "Category", value: meta.label, inline: true },
            { name: "Opened by", value: `${interaction.user}`, inline: true },
          ],
          footer: { text: "A team member will reply here. Use the button below when you're done." },
        },
      ],
      components: [closeRow()],
      // The opener and the responsible staff role are pinged; user text can never mention anyone.
      allowedMentions: { users: [interaction.user.id], roles: staff ? [staff.id] : [] },
    });
    await interaction.editReply(`Your private ticket is open: ${thread}`);
    log.info({ ticket: ticket.number, userId: interaction.user.id, category }, "ticket opened");
  } catch (err) {
    await discardTicket(db, ticket.id);
    log.error({ err }, "ticket creation failed");
    await interaction.editReply("Something went wrong opening your ticket. Please try again or contact a moderator.");
  }
}

async function close(server: Server, interaction: ButtonInteraction<"cached">) {
  const thread = interaction.channel;
  if (!thread?.isThread()) return;
  const ticket = await getTicketByThread(db, server.guild.id, thread.id);
  if (!ticket) {
    await interaction.reply({ content: "This thread is not a ticket.", flags: MessageFlags.Ephemeral });
    return;
  }
  const canManageThreads = interaction.memberPermissions.has(PermissionFlagsBits.ManageThreads);
  if (!canCloseTicket({ userId: interaction.user.id, openerId: ticket.openerId, canManageThreads })) {
    await interaction.reply({ content: "Only the person who opened this ticket or staff can close it.", flags: MessageFlags.Ephemeral });
    return;
  }
  const closed = await closeTicket(db, { guildId: server.guild.id, threadId: thread.id, closedById: interaction.user.id });
  if (!closed) {
    await interaction.reply({ content: "This ticket is already closed.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ embeds: [{ color: EMBED_COLORS.resolved, description: `🔒 Ticket closed by ${interaction.user}. Thanks for reaching out!` }], allowedMentions: { parse: [] } });
  await thread.setLocked(true, "Ticket closed").catch(() => {});
  await thread.setArchived(true, "Ticket closed").catch(() => {});

  const modLog = server.channel("modLog");
  await modLog
    ?.send({
      embeds: [
        {
          color: EMBED_COLORS.info,
          title: `Ticket #${closed.number} closed`,
          fields: [
            { name: "Subject", value: closed.subject.slice(0, 1024) },
            { name: "Category", value: isTicketCategory(closed.category) ? TICKET_CATEGORIES[closed.category].label : closed.category, inline: true },
            { name: "Opened by", value: `<@${closed.openerId}>`, inline: true },
            { name: "Closed by", value: `${interaction.user}`, inline: true },
            { name: "Open for", value: formatDuration((closed.closedAt?.getTime() ?? Date.now()) - closed.createdAt.getTime()), inline: true },
            { name: "Thread", value: `${thread}`, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      allowedMentions: { parse: [] },
    })
    .catch((err) => log.warn({ err }, "could not write to mod-log"));
  log.info({ ticket: closed.number, closedBy: interaction.user.id }, "ticket closed");
}

export async function onTicketInteraction(server: Server, interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">) {
  const [, action, arg] = interaction.customId.split(":");
  if (interaction.isButton() && action === "open" && arg && isTicketCategory(arg)) return showModal(interaction, arg);
  if (interaction.isModalSubmit() && action === "submit" && arg && isTicketCategory(arg)) return openTicket(server, interaction, arg);
  if (interaction.isButton() && action === "close") return close(server, interaction);
}
