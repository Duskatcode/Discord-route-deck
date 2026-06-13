import fs from "node:fs";
import path from "node:path";

import { env } from "../config/env.js";
import {
  createPanel,
  getActivePanel,
  getPanelByName,
  getPanels,
  getSoundsByPanelName,
  replacePanelSounds,
  setActivePanel,
  setupPanelStorage
} from "../services/panel.service.js";

const ALLOWED_EXTENSIONS = new Set([".mp3", ".ogg"]);
const MAX_SOUNDS_PER_PANEL = 8;
const MAX_SOUND_NAME_LENGTH = 32;

const panelDescriptions: Record<string, string> = {
  anime: "Panel de sonidos anime.",
  memes: "Panel de sonidos meme.",
  terror: "Panel de sonidos de terror."
};

function normalizeSoundName(
  filename: string,
  position: number,
  usedNames: Set<string>
) {
  const extension = path.extname(filename);
  const basename = path.basename(filename, extension);

  let normalized = basename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length < 2) {
    normalized = `sound-${position}`;
  }

  normalized = normalized
    .slice(0, MAX_SOUND_NAME_LENGTH)
    .replace(/-+$/g, "");

  let candidate = normalized;
  let duplicateIndex = 2;

  while (usedNames.has(candidate)) {
    const suffix = `-${duplicateIndex}`;
    const maximumBaseLength =
      MAX_SOUND_NAME_LENGTH - suffix.length;

    candidate =
      normalized.slice(0, maximumBaseLength).replace(/-+$/g, "") +
      suffix;

    duplicateIndex += 1;
  }

  usedNames.add(candidate);

  return candidate;
}

function makeRelativeFilePath(absoluteFilePath: string) {
  const relativePath = path
    .relative(process.cwd(), absoluteFilePath)
    .split(path.sep)
    .join("/");

  return relativePath.startsWith(".")
    ? relativePath
    : `./${relativePath}`;
}

setupPanelStorage();

const soundsRoot = path.resolve(env.SOUNDS_PATH);

if (!fs.existsSync(soundsRoot)) {
  throw new Error(
    `La carpeta de sonidos no existe: ${soundsRoot}`
  );
}

const panelDirectories = fs
  .readdirSync(soundsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name));

if (panelDirectories.length === 0) {
  throw new Error(
    `No se encontraron carpetas de paneles en ${soundsRoot}`
  );
}

console.log("Synchronizing SoundDeck panels...");
console.log("");

for (const panelDirectoryEntry of panelDirectories) {
  const panelName = panelDirectoryEntry.name.toLowerCase();
  const panelDirectory = path.join(
    soundsRoot,
    panelDirectoryEntry.name
  );

  const audioFiles = fs
    .readdirSync(panelDirectory, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isFile()) {
        return false;
      }

      const extension = path
        .extname(entry.name)
        .toLowerCase();

      return ALLOWED_EXTENSIONS.has(extension);
    })
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (audioFiles.length > MAX_SOUNDS_PER_PANEL) {
    throw new Error(
      `El panel "${panelName}" tiene ${audioFiles.length} archivos. ` +
      `El máximo permitido es ${MAX_SOUNDS_PER_PANEL}.`
    );
  }

  const existingPanel = getPanelByName(panelName);

  createPanel(
    panelName,
    existingPanel?.description ??
      panelDescriptions[panelName] ??
      `Panel de sonidos ${panelName}.`
  );

  const usedNames = new Set<string>();

  const sounds = audioFiles.map((filename, index) => {
    const absoluteFilePath = path.join(
      panelDirectory,
      filename
    );

    return {
      name: normalizeSoundName(
        filename,
        index + 1,
        usedNames
      ),
      filePath: makeRelativeFilePath(absoluteFilePath),
      emoji: null,
      volume: 1,
      position: index + 1
    };
  });

  replacePanelSounds(panelName, sounds);

  console.log(`Panel: ${panelName}`);
  console.log(`Files synchronized: ${sounds.length}/8`);

  for (let index = 0; index < sounds.length; index += 1) {
    const originalFilename = audioFiles[index];
    const sound = sounds[index];

    if (!originalFilename || !sound) {
      continue;
    }

    console.log(
      `  ${sound.position}. ${originalFilename}`
    );

    console.log(
      `     Discord name: ${sound.name}`
    );
  }

  console.log("");
}

if (!getActivePanel()) {
  const panels = getPanels();
  const preferredPanel =
    panels.find((panel) => panel.name === "memes") ??
    panels[0];

  if (preferredPanel) {
    setActivePanel(preferredPanel.name);
  }
}

console.log("Synchronization summary:");
console.log("");

for (const panel of getPanels()) {
  const sounds = getSoundsByPanelName(panel.name);

  console.log(
    `- ${panel.name}: ${sounds.length}/8` +
    `${panel.is_active === 1 ? " (active)" : ""}`
  );
}
