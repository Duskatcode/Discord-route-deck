import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";
import { env } from "./config/env.js";

const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);

const commandData = commands.map((command) => command.data.toJSON());

console.log("Registering SoundDeck slash commands...");

await rest.put(
  Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID),
  {
    body: commandData
  }
);

console.log("Slash commands registered successfully.");
