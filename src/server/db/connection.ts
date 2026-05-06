import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getConfig } from "../config/index.js";
import { applySchema } from "./schema.js";

let instance: Database.Database | null = null;

/**
 * 获取 SQLite 数据库实例（单例）。
 * 首次调用时会创建数据库目录、启用 WAL 模式与外键约束，并自动应用 Schema。
 */
export function getDb(): Database.Database {
  if (instance) return instance;
  const cfg = getConfig();
  const dir = path.dirname(cfg.dbFile);
  // 若数据库文件所在目录不存在则递归创建
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

/** 关闭当前数据库连接并将单例置空。 */
export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
