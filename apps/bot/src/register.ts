import { REST, Routes } from "discord.js";
import { commands } from "./commands";
import { env } from "./env";

/** Registers slash commands globally, or instantly to DISCORD_DEV_GUILD_ID when set. */
const rest = new REST({ version: "10" }).setToken(env.DISCORD_BOT_TOKEN);
const body = commands.map((c) => c.data);
const route = env.DISCORD_DEV_GUILD_ID
  ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_DEV_GUILD_ID)
  : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

await rest.put(route, { body });
console.log(`Registered ${body.length} commands ${env.DISCORD_DEV_GUILD_ID ? `to guild ${env.DISCORD_DEV_GUILD_ID}` : "globally (may take up to an hour to appear)"}.`);
process.exit(0);
