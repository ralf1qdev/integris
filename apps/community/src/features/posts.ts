import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import { CHANNELS } from "../config";
import { footerFor, isPostKey, POSTS, postEmbeds, type PostKey } from "../content";
import { log } from "../runtime";
import type { Server } from "../server";
import { panelComponents } from "./tickets";

export const postCommand = new SlashCommandBuilder()
  .setName("post")
  .setDescription("Publish or refresh an information post (rules, about, FAQ, help panel)")
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((o) =>
    o
      .setName("content")
      .setDescription("Which post to publish")
      .setRequired(true)
      .addChoices(...(Object.keys(POSTS) as PostKey[]).map((k) => ({ name: `${POSTS[k].label} → #${CHANNELS[POSTS[k].channel]}`, value: k }))),
  );

/** Finds this bot's earlier post with the same key so it can be edited in place. */
async function findExisting(channel: TextChannel, key: PostKey) {
  const recent = await channel.messages.fetch({ limit: 50 });
  return recent.find((m) => m.author.id === channel.client.user.id && m.embeds[0]?.footer?.text === footerFor(key)) ?? null;
}

export async function onPostCommand(server: Server, interaction: ChatInputCommandInteraction<"cached">) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "You need Manage Server to publish posts.", flags: MessageFlags.Ephemeral });
    return;
  }
  const key = interaction.options.getString("content", true);
  if (!isPostKey(key)) return;
  const channel = server.channel(POSTS[key].channel);
  if (!channel) {
    await interaction.reply({ content: `Channel #${CHANNELS[POSTS[key].channel]} not found.`, flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const payload = {
    embeds: postEmbeds(key, server.links()),
    components: key === "help-panel" ? panelComponents() : [],
    allowedMentions: { parse: [] as never[] },
  };
  const existing = await findExisting(channel, key);
  const message = existing ? await existing.edit(payload) : await channel.send(payload);
  log.info({ key, channelId: channel.id, edited: Boolean(existing), by: interaction.user.id }, "post published");
  await interaction.editReply(`${existing ? "Updated" : "Published"} ${POSTS[key].label} in ${channel}: ${message.url}`);
}
