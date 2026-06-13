import { getPanels, getSoundsByPanelName, setupPanelStorage } from "../services/panel.service.js";
import { validateAudioFile } from "../services/audio.service.js";

setupPanelStorage();

const panels = getPanels();

let totalSounds = 0;
let totalValid = 0;
let totalInvalid = 0;

console.log("Validating SoundDeck panels...");
console.log("");

for (const panel of panels) {
  const sounds = getSoundsByPanelName(panel.name);

  console.log(`Panel: ${panel.name}`);
  console.log(`Sounds registered: ${sounds.length}/8`);

  if (sounds.length > 8) {
    console.log("  ERROR: El panel tiene más de 8 sonidos.");
    totalInvalid += sounds.length;
    continue;
  }

  for (const sound of sounds) {
    totalSounds += 1;

    const result = validateAudioFile(sound.file_path);

    if (result.valid) {
      totalValid += 1;

      console.log(
        `  OK ${sound.position}. ${sound.name} -> ${sound.file_path} ` +
        `(${result.sizeBytes} bytes, ${result.durationSeconds?.toFixed(2)}s)`
      );

      continue;
    }

    totalInvalid += 1;

    console.log(`  FAIL ${sound.position}. ${sound.name} -> ${sound.file_path}`);

    for (const error of result.errors) {
      console.log(`    - ${error}`);
    }
  }

  console.log("");
}

console.log("Validation summary:");
console.log(`Total sounds: ${totalSounds}`);
console.log(`Valid sounds: ${totalValid}`);
console.log(`Invalid sounds: ${totalInvalid}`);

if (totalInvalid > 0) {
  process.exit(1);
}
