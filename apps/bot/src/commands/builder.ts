import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

/**
 * Every Integris command is guild-only and hidden by default from members
 * without Manage Server. The handler re-checks permissions at runtime because
 * server admins can override command visibility.
 */
export function adminCommand(name: string, description: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
}
