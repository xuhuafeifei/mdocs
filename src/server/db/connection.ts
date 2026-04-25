import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getConfig } from "../config/index.js";
import { applySchema } from "./schema.js";

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;
  const cfg = getConfig();
  const dir = path.dirname(cfg.dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const db = new Database(cfg.dbFile);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  instance = db;
  return db;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
