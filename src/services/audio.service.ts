import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const MAX_FILE_SIZE_BYTES = 512 * 1024;
const MAX_DURATION_SECONDS = 5.2;
const ALLOWED_EXTENSIONS = new Set([".mp3", ".ogg"]);

export type AudioValidationResult = {
  filePath: string;
  exists: boolean;
  valid: boolean;
  errors: string[];
  sizeBytes?: number;
  durationSeconds?: number;
};

function getAudioDurationSeconds(filePath: string): number | undefined {
  try {
    const output = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath
      ],
      { encoding: "utf8" }
    );

    const duration = Number.parseFloat(output.trim());

    if (Number.isNaN(duration)) {
      return undefined;
    }

    return duration;
  } catch {
    return undefined;
  }
}

export function validateAudioFile(filePath: string): AudioValidationResult {
  const errors: string[] = [];
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    return {
      filePath,
      exists: false,
      valid: false,
      errors: ["El archivo no existe."]
    };
  }

  const stats = fs.statSync(resolvedPath);
  const extension = path.extname(resolvedPath).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    errors.push("Formato inválido. Usa .mp3 o .ogg.");
  }

  if (stats.size > MAX_FILE_SIZE_BYTES) {
    errors.push(`Archivo demasiado pesado: ${stats.size} bytes. Máximo: ${MAX_FILE_SIZE_BYTES} bytes.`);
  }

  const durationSeconds = getAudioDurationSeconds(resolvedPath);

  if (durationSeconds === undefined) {
    errors.push("No se pudo leer la duración con ffprobe.");
  } else if (durationSeconds > MAX_DURATION_SECONDS) {
    errors.push(`Audio demasiado largo: ${durationSeconds.toFixed(2)}s. Máximo: ${MAX_DURATION_SECONDS}s.`);
  }

  return {
    filePath,
    exists: true,
    valid: errors.length === 0,
    errors,
    sizeBytes: stats.size,
    durationSeconds
  };
}
