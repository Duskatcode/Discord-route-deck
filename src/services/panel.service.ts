import { getDatabase, initDatabase } from "../db/database.js";

export type Panel = {
  id: number;
  name: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type PanelSound = {
  id: number;
  panel_id: number;
  name: string;
  file_path: string;
  emoji: string | null;
  volume: number;
  position: number;
  created_at: string;
};

export type PanelSoundInput = {
  name: string;
  filePath: string;
  emoji?: string | null;
  volume?: number;
  position: number;
};

export function setupPanelStorage() {
  initDatabase();
}

export function createPanel(
  name: string,
  description: string | null = null
) {
  const db = getDatabase();

  db.prepare(`
    INSERT INTO panels (name, description)
    VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `).run(name, description);

  return getPanelByName(name);
}

export function getPanels() {
  const db = getDatabase();

  return db
    .prepare(`
      SELECT
        id,
        name,
        description,
        is_active,
        created_at,
        updated_at
      FROM panels
      ORDER BY name ASC
    `)
    .all() as Panel[];
}

export function getPanelByName(name: string) {
  const db = getDatabase();

  return db
    .prepare(`
      SELECT
        id,
        name,
        description,
        is_active,
        created_at,
        updated_at
      FROM panels
      WHERE name = ?
    `)
    .get(name) as Panel | undefined;
}

export function getSoundsByPanelName(panelName: string) {
  const db = getDatabase();

  const panel = getPanelByName(panelName);

  if (!panel) {
    return [];
  }

  return db
    .prepare(`
      SELECT
        id,
        panel_id,
        name,
        file_path,
        emoji,
        volume,
        position,
        created_at
      FROM sounds
      WHERE panel_id = ?
      ORDER BY position ASC
    `)
    .all(panel.id) as PanelSound[];
}

export function replacePanelSounds(
  panelName: string,
  sounds: PanelSoundInput[]
) {
  if (sounds.length > 8) {
    throw new Error(
      `El panel "${panelName}" tiene ${sounds.length} sonidos. El máximo es 8.`
    );
  }

  const positions = new Set<number>();
  const names = new Set<string>();

  for (const sound of sounds) {
    if (sound.position < 1 || sound.position > 8) {
      throw new Error(
        `Posición inválida para "${sound.name}": ${sound.position}.`
      );
    }

    if (positions.has(sound.position)) {
      throw new Error(
        `La posición ${sound.position} está duplicada en "${panelName}".`
      );
    }

    if (names.has(sound.name)) {
      throw new Error(
        `El nombre "${sound.name}" está duplicado en "${panelName}".`
      );
    }

    positions.add(sound.position);
    names.add(sound.name);
  }

  const db = getDatabase();
  const panel = getPanelByName(panelName);

  if (!panel) {
    throw new Error(`El panel "${panelName}" no existe.`);
  }

  const replaceTransaction = db.transaction(() => {
    db.prepare(`
      DELETE FROM sounds
      WHERE panel_id = ?
    `).run(panel.id);

    const insertSound = db.prepare(`
      INSERT INTO sounds (
        panel_id,
        name,
        file_path,
        emoji,
        volume,
        position
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const sound of sounds) {
      insertSound.run(
        panel.id,
        sound.name,
        sound.filePath,
        sound.emoji ?? null,
        sound.volume ?? 1,
        sound.position
      );
    }

    db.prepare(`
      UPDATE panels
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(panel.id);
  });

  replaceTransaction();
}

export function setActivePanel(panelName: string) {
  const db = getDatabase();
  const panel = getPanelByName(panelName);

  if (!panel) {
    throw new Error(`El panel "${panelName}" no existe.`);
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE panels
      SET is_active = 0
    `).run();

    db.prepare(`
      UPDATE panels
      SET
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(panel.id);
  });

  transaction();
}

export function getActivePanel() {
  const db = getDatabase();

  return db
    .prepare(`
      SELECT
        id,
        name,
        description,
        is_active,
        created_at,
        updated_at
      FROM panels
      WHERE is_active = 1
      LIMIT 1
    `)
    .get() as Panel | undefined;
}
