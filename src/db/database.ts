import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

import { env } from "../config/env.js";

let database: Database.Database | null = null;

function ensureDataDirectory() {
  const databaseDirectory = path.dirname(env.DATABASE_PATH);

  if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory, { recursive: true });
  }
}

export function getDatabase() {
  if (database) {
    return database;
  }

  ensureDataDirectory();

  database = new Database(env.DATABASE_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  return database;
}

export function initDatabase() {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS panels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      panel_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      emoji TEXT,
      volume REAL NOT NULL DEFAULT 1.0,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE,
      UNIQUE(panel_id, position),
      UNIQUE(panel_id, name)
    );
  `);
}

export function closeDatabase() {
  if (database) {
    database.close();
    database = null;
  }
}
