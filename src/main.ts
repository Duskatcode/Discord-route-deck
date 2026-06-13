import {
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  InteractionReplyOptions,
  MessageFlags
} from "discord.js";

import { commandMap } from "./commands/index.js";
import { env } from "./config/env.js";
import { setupPanelStorage } from "./services/panel.service.js";

console.log("SoundDeck booting...");
console.log(`Environment: ${env.NODE_ENV}`);
console.log(`Target guild: ${env.GUILD_ID}`);

console.log("Initializing local storage...");
setupPanelStorage();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`SoundDeck online as ${readyClient.user.tag}`);
  console.log(`Configured exclusively for guild ${env.GUILD_ID}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.guildId !== env.GUILD_ID) {
    await interaction.reply({
      content: "SoundDeck no está configurado para este servidor.",
      flags: MessageFlags.Ephemeral
    });

    return;
  }

  console.log(
    `Command received: /${interaction.commandName} ` +
    `in guild ${interaction.guildId}`
  );

  const command = commandMap.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: "Comando no reconocido por SoundDeck.",
      flags: MessageFlags.Ephemeral
    });

    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error("Command execution error:");
    console.error(error);

    const errorReply: InteractionReplyOptions = {
      content: "Ocurrió un error ejecutando el comando.",
      flags: MessageFlags.Ephemeral
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorReply);
    } else {
      await interaction.reply(errorReply);
    }
  }
});

try {
  console.log("Logging into Discord...");
  await client.login(env.DISCORD_TOKEN);
} catch (error) {
  console.error("Discord login failed:");
  console.error(error);
  process.exit(1);
}
