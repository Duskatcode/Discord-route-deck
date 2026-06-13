import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  getPanels,
  getSoundsByPanelName,
  setupPanelStorage
} from "../services/panel.service.js";

import {
  validateAudioFile
} from "../services/audio.service.js";

const SOURCE_ROOT = path.resolve("./sounds");
const BACKUP_ROOT = path.resolve("./sounds-original");

const TARGET_DURATION_SECONDS = 5;
const TARGET_SAMPLE_RATE = "48000";
const TARGET_BITRATE = "96k";

type NormalizeResult = {
  panel: string;
  sound: string;
  status: "valid" | "normalized" | "failed";
  message?: string;
};

function ensureDirectory(directoryPath: string) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function getSafeRelativePath(filePath: string) {
  const relativePath = path.relative(SOURCE_ROOT, filePath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      `El archivo está fuera de la carpeta sounds: ${filePath}`
    );
  }

  return relativePath;
}

function createBackup(sourcePath: string) {
  const relativePath = getSafeRelativePath(sourcePath);
  const backupPath = path.join(BACKUP_ROOT, relativePath);

  ensureDirectory(path.dirname(backupPath));

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(sourcePath, backupPath);
  }

  return backupPath;
}

function normalizeAudio(
  sourcePath: string,
  temporaryPath: string,
  extension: string
) {
  const codecArguments =
    extension === ".ogg"
      ? ["-c:a", "libopus", "-b:a", TARGET_BITRATE]
      : ["-c:a", "libmp3lame", "-b:a", TARGET_BITRATE];

  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      sourcePath,
      "-t",
      String(TARGET_DURATION_SECONDS),
      "-vn",
      "-ac",
      "1",
      "-ar",
      TARGET_SAMPLE_RATE,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      ...codecArguments,
      temporaryPath
    ],
    {
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() ||
        `FFmpeg terminó con código ${result.status}.`
    );
  }
}

setupPanelStorage();
ensureDirectory(BACKUP_ROOT);

const results: NormalizeResult[] = [];

console.log("Normalizing SoundDeck audio...");
console.log("");

for (const panel of getPanels()) {
  const sounds = getSoundsByPanelName(panel.name);

  console.log(`Panel: ${panel.name}`);

  for (const sound of sounds) {
    const sourcePath = path.resolve(sound.file_path);
    const beforeValidation = validateAudioFile(sound.file_path);

    if (beforeValidation.valid) {
      results.push({
        panel: panel.name,
        sound: sound.name,
        status: "valid"
      });

      console.log(`  SKIP ${sound.position}. ${sound.name} — ya es válido`);
      continue;
    }

    if (!beforeValidation.exists) {
      results.push({
        panel: panel.name,
        sound: sound.name,
        status: "failed",
        message: "El archivo no existe."
      });

      console.log(`  FAIL ${sound.position}. ${sound.name}`);
      console.log("    - El archivo no existe.");
      continue;
    }

    const extension = path.extname(sourcePath).toLowerCase();

    if (extension !== ".mp3" && extension !== ".ogg") {
      results.push({
        panel: panel.name,
        sound: sound.name,
        status: "failed",
        message: `Extensión no soportada: ${extension}`
      });

      console.log(`  FAIL ${sound.position}. ${sound.name}`);
      console.log(`    - Extensión no soportada: ${extension}`);
      continue;
    }

    const temporaryPath =
      `${sourcePath}.sounddeck-temp${extension}`;

    try {
      const backupPath = createBackup(sourcePath);

      normalizeAudio(
        sourcePath,
        temporaryPath,
        extension
      );

      fs.renameSync(temporaryPath, sourcePath);

      const afterValidation = validateAudioFile(sound.file_path);

      if (!afterValidation.valid) {
        fs.copyFileSync(backupPath, sourcePath);

        throw new Error(
          afterValidation.errors.join(" ")
        );
      }

      results.push({
        panel: panel.name,
        sound: sound.name,
        status: "normalized"
      });

      console.log(`  OK ${sound.position}. ${sound.name}`);
      console.log(
        `    ${afterValidation.sizeBytes} bytes, ` +
        `${afterValidation.durationSeconds?.toFixed(2)}s`
      );
    } catch (error) {
      if (fs.existsSync(temporaryPath)) {
        fs.rmSync(temporaryPath);
      }

      const message =
        error instanceof Error
          ? error.message
          : "Error desconocido.";

      results.push({
        panel: panel.name,
        sound: sound.name,
        status: "failed",
        message
      });

      console.log(`  FAIL ${sound.position}. ${sound.name}`);
      console.log(`    - ${message}`);
    }
  }

  console.log("");
}

const alreadyValid = results.filter(
  (result) => result.status === "valid"
).length;

const normalized = results.filter(
  (result) => result.status === "normalized"
).length;

const failed = results.filter(
  (result) => result.status === "failed"
).length;

console.log("Normalization summary:");
console.log(`Already valid: ${alreadyValid}`);
console.log(`Normalized: ${normalized}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${results.length}`);
console.log(`Original backups: ${BACKUP_ROOT}`);

if (failed > 0) {
  process.exit(1);
}
