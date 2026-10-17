import { ChannelType, type Message } from "discord.js";
import { SUGGESTION_REACTIONS } from "../config";
import { log } from "../runtime";
import type { Server } from "../server";

/**
 * Adds voting reactions to every new post in #suggestions and opens a discussion
 * thread so replies don't bury other suggestions. Reads no message content.
 */
export async function onMessage(server: Server, message: Message) {
  if (message.author.bot || message.system || !message.inGuild()) return;
  const channel = server.channel("suggestions");
  if (!channel || message.channelId !== channel.id || message.channel.type !== ChannelType.GuildText) return;

  try {
    for (const emoji of SUGGESTION_REACTIONS) await message.react(emoji);
    await message.startThread({ name: `Discussion — ${message.author.username}`.slice(0, 100), autoArchiveDuration: 10080, reason: "Suggestion discussion" });
  } catch (err) {
    log.warn({ err, messageId: message.id }, "could not process suggestion");
  }
}
