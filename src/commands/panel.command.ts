import {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";

import {
  getActivePanel,
  getPanelByName,
  getPanels,
  getSoundsByPanelName,
  setActivePanel
} from "../services/panel.service.js";

import {
  replaceGuildSoundboard
} from "../services/soundboard.service.js";

function createPrivateReply(
  content: string
): InteractionReplyOptions {
  return {
    content,
    flags: MessageFlags.Ephemeral
  };
}

function formatPanelList() {
  const panels = getPanels();

  if (panels.length === 0) {
    return "No hay paneles registrados todavía.";
  }

  const lines = panels.map((panel) => {
    const activeMarker =
      panel.is_active === 1
        ? "actual"
        : "disponible";

    const description = panel.description
      ? ` — ${panel.description}`
      : "";

    return `- ${panel.name} (${activeMarker})${description}`;
  });

  return [
    "Paneles disponibles:",
    "",
    ...lines
  ].join("\n");
}

function formatPanelPreview(panelName: string) {
  const panel = getPanelByName(panelName);

  if (!panel) {
    return (
      `El panel "${panelName}" no existe. ` +
      "Usa /panel list para ver los paneles disponibles."
    );
  }

  const sounds =
    getSoundsByPanelName(panelName);

  if (sounds.length === 0) {
    return (
      `El panel "${panelName}" existe, ` +
      "pero no tiene sonidos registrados."
    );
  }

  const lines = sounds.map((sound) => {
    const emoji = sound.emoji
      ? `${sound.emoji} `
      : "";

    return (
      `${sound.position}. ` +
      `${emoji}${sound.name} → ${sound.file_path}`
    );
  });

  return [
    `Panel: ${panel.name}`,
    `Descripción: ${panel.description ?? "Sin descripción"}`,
    `Sonidos: ${sounds.length}/8`,
    "",
    ...lines
  ].join("\n");
}

function formatCurrentPanel() {
  const panel = getActivePanel();

  if (!panel) {
    return "No hay ningún panel activo registrado.";
  }

  const sounds =
    getSoundsByPanelName(panel.name);

  return [
    `Panel activo: ${panel.name}`,
    `Descripción: ${panel.description ?? "Sin descripción"}`,
    `Sonidos registrados: ${sounds.length}/8`
  ].join("\n");
}

function hasLoadPermission(
  interaction: ChatInputCommandInteraction
) {
  return Boolean(
    interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuildExpressions
    ) ||
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  );
}

export const panelCommand = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription(
      "Manage SoundDeck sound panels."
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ping")
        .setDescription(
          "Check if SoundDeck is active."
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription(
          "List available SoundDeck panels."
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("preview")
        .setDescription(
          "Preview the sounds registered in a panel."
        )
        .addStringOption((option) =>
          option
            .setName("panel")
            .setDescription(
              "Panel name to preview."
            )
            .setRequired(true)
            .addChoices(
              {
                name: "Anime",
                value: "anime"
              },
              {
                name: "Memes",
                value: "memes"
              },
              {
                name: "Terror",
                value: "terror"
              }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("current")
        .setDescription(
          "Show the active SoundDeck panel."
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("load")
        .setDescription(
          "Replace the server Soundboard with a panel."
        )
        .addStringOption((option) =>
          option
            .setName("panel")
            .setDescription(
              "Panel to upload to Discord."
            )
            .setRequired(true)
            .addChoices(
              {
                name: "Anime",
                value: "anime"
              },
              {
                name: "Memes",
                value: "memes"
              },
              {
                name: "Terror",
                value: "terror"
              }
            )
        )
        .addBooleanOption((option) =>
          option
            .setName("confirm")
            .setDescription(
              "Confirm replacement of the current Soundboard."
            )
            .setRequired(true)
        )
    ),

  async execute(
    interaction: ChatInputCommandInteraction
  ) {
    const subcommand =
      interaction.options.getSubcommand();

    if (subcommand === "ping") {
      await interaction.reply(
        createPrivateReply(
          "SoundDeck activo."
        )
      );

      return;
    }

    if (subcommand === "list") {
      await interaction.reply(
        createPrivateReply(
          formatPanelList()
        )
      );

      return;
    }

    if (subcommand === "preview") {
      const panelName =
        interaction.options.getString(
          "panel",
          true
        );

      await interaction.reply(
        createPrivateReply(
          formatPanelPreview(panelName)
        )
      );

      return;
    }

    if (subcommand === "current") {
      await interaction.reply(
        createPrivateReply(
          formatCurrentPanel()
        )
      );

      return;
    }

    if (subcommand === "load") {
      if (!interaction.guild) {
        await interaction.reply(
          createPrivateReply(
            "Este comando solo funciona dentro de un servidor."
          )
        );

        return;
      }

      if (!hasLoadPermission(interaction)) {
        await interaction.reply(
          createPrivateReply(
            "No tienes permiso para administrar las expresiones del servidor."
          )
        );

        return;
      }

      const panelName =
        interaction.options.getString(
          "panel",
          true
        );

      const confirmed =
        interaction.options.getBoolean(
          "confirm",
          true
        );

      if (!confirmed) {
        await interaction.reply(
          createPrivateReply(
            "Carga cancelada. Usa confirm:true para reemplazar el Soundboard."
          )
        );

        return;
      }

      const botMember =
        interaction.guild.members.me ??
        await interaction.guild.members.fetchMe();

      const botCanCreate =
        botMember.permissions.has(
          PermissionFlagsBits.CreateGuildExpressions
        );

      const botCanManage =
        botMember.permissions.has(
          PermissionFlagsBits.ManageGuildExpressions
        );

      if (!botCanCreate || !botCanManage) {
        await interaction.reply(
          createPrivateReply(
            [
              "SoundDeck no tiene los permisos requeridos:",
              `Create Expressions: ${botCanCreate ? "sí" : "no"}`,
              `Manage Expressions: ${botCanManage ? "sí" : "no"}`
            ].join("\n")
          )
        );

        return;
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral
      });

      try {
        const result =
          await replaceGuildSoundboard(
            interaction.guild,
            panelName
          );

        setActivePanel(panelName);

        await interaction.editReply({
          content: [
            `Panel "${panelName}" cargado correctamente.`,
            `Sonidos eliminados: ${result.removedSounds}`,
            `Sonidos subidos: ${result.uploadedSounds.length}/8`,
            "",
            ...result.uploadedSounds.map(
              (name, index) =>
                `${index + 1}. ${name}`
            )
          ].join("\n")
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Error desconocido.";

        console.error(
          "Soundboard load error:",
          error
        );

        await interaction.editReply({
          content: [
            `No se pudo cargar el panel "${panelName}".`,
            message
          ].join("\n")
        });
      }

      return;
    }

    await interaction.reply(
      createPrivateReply(
        "Subcomando no reconocido."
      )
    );
  }
};
