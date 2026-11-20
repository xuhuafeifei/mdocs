/**
 * agent_model_configs 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { AgentModelConfigs } from "../entity/agent-model-config.entity.js";

export type { AgentModelConfigs } from "../entity/agent-model-config.entity.js";

const COLUMNS = `id, owner_visitor_id, name, provider, kind, provider_id,
  base_url, api_type, compat_json, model_id, api_key, context_window,
  thinking_level, run_timeout_seconds, is_default, updated_at`;

export function listAgentModelConfigsByOwner(
  ownerVisitorId: string,
  db?: Database.Database,
): AgentModelConfigs[] {
  return resolveDb(db)
    .prepare<string, AgentModelConfigs>(
      `SELECT ${COLUMNS} FROM agent_model_configs
       WHERE owner_visitor_id = ?
       ORDER BY is_default DESC, updated_at DESC`,
    )
    .all(ownerVisitorId);
}

export function findAgentModelConfigById(
  id: string,
  ownerVisitorId: string,
  db?: Database.Database,
): AgentModelConfigs | undefined {
  return resolveDb(db)
    .prepare<[string, string], AgentModelConfigs>(
      `SELECT ${COLUMNS} FROM agent_model_configs WHERE id = ? AND owner_visitor_id = ?`,
    )
    .get(id, ownerVisitorId);
}

export function findDefaultAgentModelConfigByOwner(
  ownerVisitorId: string,
  db?: Database.Database,
): AgentModelConfigs | undefined {
  const conn = resolveDb(db);
  return (
    conn
      .prepare<string, AgentModelConfigs>(
        `SELECT ${COLUMNS} FROM agent_model_configs
         WHERE owner_visitor_id = ? AND is_default = 1
         LIMIT 1`,
      )
      .get(ownerVisitorId) ??
    conn
      .prepare<string, AgentModelConfigs>(
        `SELECT ${COLUMNS} FROM agent_model_configs
         WHERE owner_visitor_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(ownerVisitorId)
  );
}

export function countAgentModelConfigsByOwner(
  ownerVisitorId: string,
  db?: Database.Database,
): number {
  const row = resolveDb(db)
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) AS c FROM agent_model_configs WHERE owner_visitor_id = ?`,
    )
    .get(ownerVisitorId);
  return row?.c ?? 0;
}

/** DB 里仍留着明文 key 的行，供一次性迁到 secrets。 */
export function listAgentModelConfigsWithApiKey(
  db?: Database.Database,
): AgentModelConfigs[] {
  return resolveDb(db)
    .prepare<[], AgentModelConfigs>(
      `SELECT ${COLUMNS} FROM agent_model_configs
       WHERE api_key IS NOT NULL AND api_key != ''`,
    )
    .all();
}

export function insertAgentModelConfig(
  row: AgentModelConfigs,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO agent_model_configs
         (id, owner_visitor_id, name, provider, kind, provider_id,
          base_url, api_type, compat_json, model_id, api_key, context_window,
          thinking_level, run_timeout_seconds, is_default, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.owner_visitor_id,
      row.name,
      row.provider,
      row.kind,
      row.provider_id,
      row.base_url,
      row.api_type,
      row.compat_json,
      row.model_id,
      row.api_key,
      row.context_window,
      row.thinking_level,
      row.run_timeout_seconds,
      row.is_default,
      row.updated_at,
    );
}

export function updateAgentModelConfig(
  row: AgentModelConfigs,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `UPDATE agent_model_configs SET
         name = ?, provider = ?, kind = ?, provider_id = ?,
         base_url = ?, api_type = ?, compat_json = ?, model_id = ?,
         api_key = ?, context_window = ?, thinking_level = ?,
         run_timeout_seconds = ?, is_default = ?, updated_at = ?
       WHERE id = ? AND owner_visitor_id = ?`,
    )
    .run(
      row.name,
      row.provider,
      row.kind,
      row.provider_id,
      row.base_url,
      row.api_type,
      row.compat_json,
      row.model_id,
      row.api_key,
      row.context_window,
      row.thinking_level,
      row.run_timeout_seconds,
      row.is_default,
      row.updated_at,
      row.id,
      row.owner_visitor_id,
    );
}

export function deleteAgentModelConfig(
  id: string,
  ownerVisitorId: string,
  db?: Database.Database,
): boolean {
  const result = resolveDb(db)
    .prepare(`DELETE FROM agent_model_configs WHERE id = ? AND owner_visitor_id = ?`)
    .run(id, ownerVisitorId);
  return result.changes > 0;
}

export function clearAgentModelConfigDefaults(
  ownerVisitorId: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(`UPDATE agent_model_configs SET is_default = 0 WHERE owner_visitor_id = ?`)
    .run(ownerVisitorId);
}

/** 把指定配置标为默认。没有匹配行时返回 false。 */
export function markAgentModelConfigDefault(
  id: string,
  ownerVisitorId: string,
  updatedAt: string,
  db?: Database.Database,
): boolean {
  const result = resolveDb(db)
    .prepare(
      `UPDATE agent_model_configs SET is_default = 1, updated_at = ?
       WHERE id = ? AND owner_visitor_id = ?`,
    )
    .run(updatedAt, id, ownerVisitorId);
  return result.changes > 0;
}
