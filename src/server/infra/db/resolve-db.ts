/**
 * repo 取连接：默认单例 getDb()；可选末参 `db?` 仅单测注入。
 */
import type Database from "better-sqlite3";
import { getDb } from "./connection.js";

export function resolveDb(db?: Database.Database): Database.Database {
  return db ?? getDb();
}
