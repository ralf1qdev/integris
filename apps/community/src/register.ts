import { PermissionFlagsBits, REST, Routes } from "discord.js";
import { env } from "./env";
import { postCommand } from "./features/posts";

/** Permissions the community bot needs in the Integris server — no Administrator. */
export const COMMUNITY_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.ReadMessageHistory, // find and edit its own earlier posts
  PermissionFlagsBits.AddReactions, // suggestion voting
  PermissionFlagsBits.ManageRoles, // give the Member role
  PermissionFlagsBits.CreatePublicThreads, // suggestion discussions
  PermissionFlagsBits.CreatePrivateThreads, // tickets
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.ManageThreads, // lock and archive closed tickets
].reduce((a, b) => a | b, 0n);

const rest = new REST({ version: "10" }).setToken(env.COMMUNITY_BOT_TOKEN);
await rest.put(Routes.applicationGuildCommands(env.COMMUNITY_CLIENT_ID, env.COMMUNITY_GUILD_ID), { body: [postCommand.toJSON()] });
console.log("Registered /post in the community server.");
console.log(
  `Invite link: https://discord.com/oauth2/authorize?client_id=${env.COMMUNITY_CLIENT_ID}&scope=bot%20applications.commands&permissions=${COMMUNITY_PERMISSIONS}&guild_id=${env.COMMUNITY_GUILD_ID}&disable_guild_select=true`,
);
process.exit(0);
