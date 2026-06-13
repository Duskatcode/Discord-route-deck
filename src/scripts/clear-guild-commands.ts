import { REST, Routes } from "discord.js";

import { env } from "../config/env.js";

const guildId = process.argv[2];

if (!guildId) {
  console.error(
    "Uso: npm run commands:clear -- <GUILD_ID>"
  );

  process.exit(1);
}

if (!/^\d{17,20}$/.test(guildId)) {
  console.error("El GUILD_ID proporcionado no es válido.");
  process.exit(1);
}

const rest = new REST({
  version: "10"
}).setToken(env.DISCORD_TOKEN);

console.log(`Removing commands from guild ${guildId}...`);

await rest.put(
  Routes.applicationGuildCommands(
    env.CLIENT_ID,
    guildId
  ),
  {
    body: []
  }
);

console.log(
  `Commands removed from guild ${guildId}.`
);
