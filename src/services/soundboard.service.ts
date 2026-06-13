import path from "node:path";

import {
  Guild,
  Routes
} from "discord.js";

import {
  getPanelByName,
  getSoundsByPanelName
} from "./panel.service.js";

import {
  validateAudioFile
} from "./audio.service.js";

type RemoteSoundboardSound = {
  sound_id: string;
  name: string;
  volume: number;
  emoji_id: string | null;
  emoji_name: string | null;
};

type RemoteSoundboardListResponse = {
  items: RemoteSoundboardSound[];
};

type RemoteSoundBackup = {
  name: string;
  volume: number;
  emojiId: string | null;
  emojiName: string | null;
  contentType?: string;
  file: Buffer;
};

export type LoadPanelResult = {
  panelName: string;
  removedSounds: number;
  uploadedSounds: string[];
};

async function listGuildSoundboardSounds(
  guild: Guild
): Promise<RemoteSoundboardSound[]> {
  const response = await guild.client.rest.get(
    Routes.guildSoundboardSounds(guild.id)
  ) as RemoteSoundboardListResponse;

  return response.items;
}

async function downloadCurrentSounds(
  sounds: RemoteSoundboardSound[]
): Promise<RemoteSoundBackup[]> {
  const backups: RemoteSoundBackup[] = [];

  for (const sound of sounds) {
    const response = await fetch(
      `https://cdn.discordapp.com/soundboard-sounds/${sound.sound_id}`
    );

    if (!response.ok) {
      throw new Error(
        `No se pudo respaldar "${sound.name}": HTTP ${response.status}.`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") ?? undefined;

    backups.push({
      name: sound.name,
      volume: sound.volume,
      emojiId: sound.emoji_id,
      emojiName: sound.emoji_name,
      contentType,
      file: Buffer.from(arrayBuffer)
    });
  }

  return backups;
}

async function deleteGuildSounds(
  guild: Guild,
  sounds: RemoteSoundboardSound[]
) {
  for (const sound of sounds) {
    await guild.soundboardSounds.delete(sound.sound_id);
  }
}

async function restoreSoundboard(
  guild: Guild,
  backups: RemoteSoundBackup[]
) {
  for (const backup of backups) {
    await guild.soundboardSounds.create({
      name: backup.name,
      file: backup.file,
      contentType: backup.contentType,
      volume: backup.volume,
      emojiId: backup.emojiId ?? undefined,
      emojiName: backup.emojiId
        ? undefined
        : backup.emojiName ?? undefined,
      reason: "SoundDeck automatic rollback"
    });
  }
}

function validatePanelFiles(panelName: string) {
  const panel = getPanelByName(panelName);

  if (!panel) {
    throw new Error(
      `El panel "${panelName}" no existe en SQLite.`
    );
  }

  const sounds = getSoundsByPanelName(panelName);

  if (sounds.length !== 8) {
    throw new Error(
      `El panel "${panelName}" tiene ${sounds.length}/8 sonidos.`
    );
  }

  const errors: string[] = [];

  for (const sound of sounds) {
    const validation = validateAudioFile(sound.file_path);

    if (!validation.valid) {
      errors.push(
        `${sound.name}: ${validation.errors.join(" ")}`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      [
        `El panel "${panelName}" contiene archivos inválidos:`,
        ...errors
      ].join("\n")
    );
  }

  return sounds;
}

export async function replaceGuildSoundboard(
  guild: Guild,
  panelName: string
): Promise<LoadPanelResult> {
  const panelSounds = validatePanelFiles(panelName);

  const currentSounds =
    await listGuildSoundboardSounds(guild);

  /*
   * El respaldo se realiza antes de eliminar cualquier sonido.
   * Si no puede descargarse un sonido actual, la operación se cancela.
   */
  const backups =
    await downloadCurrentSounds(currentSounds);

  const uploadedSounds: string[] = [];

  try {
    await deleteGuildSounds(guild, currentSounds);

    for (const sound of panelSounds) {
      const absoluteFilePath =
        path.resolve(sound.file_path);

      const createdSound =
        await guild.soundboardSounds.create({
          name: sound.name,
          file: absoluteFilePath,
          volume: sound.volume,
          emojiName: sound.emoji ?? undefined,
          reason: `SoundDeck loaded panel "${panelName}"`
        });

      uploadedSounds.push(createdSound.name);
    }

    return {
      panelName,
      removedSounds: currentSounds.length,
      uploadedSounds
    };
  } catch (error) {
    const originalMessage =
      error instanceof Error
        ? error.message
        : "Error desconocido durante la carga.";

    let rollbackMessage =
      "El Soundboard anterior fue restaurado.";

    try {
      const partiallyUploadedSounds =
        await listGuildSoundboardSounds(guild);

      await deleteGuildSounds(
        guild,
        partiallyUploadedSounds
      );

      await restoreSoundboard(guild, backups);
    } catch (rollbackError) {
      const rollbackErrorMessage =
        rollbackError instanceof Error
          ? rollbackError.message
          : "Error desconocido durante la restauración.";

      rollbackMessage =
        `La restauración también falló: ${rollbackErrorMessage}`;
    }

    throw new Error(
      `${originalMessage} ${rollbackMessage}`
    );
  }
}
