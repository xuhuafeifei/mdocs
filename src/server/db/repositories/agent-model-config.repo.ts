import type Database from "better-sqlite3";

export interface AgentModelConfigRow {
  id: string;
  owner_visitor_id: string;
  name: string;
  provider: string;
  kind: string;
  provider_id: string | null;
  base_url: string | null;
  api_type: string;
  compat_json: string | null;
  model_id: string;
  api_key: string;
  context_window: number;
  is_default: number;
  updated_at: string;
}

export function listAgentModelConfigsByOwner(
  db: Database.Database,
  ownerVisitorId: string,
): AgentModelConfigRow[] {
  return db
    .prepare(
      `SELECT * FROM agent_model_configs
       WHERE owner_visitor_id = ?
       ORDER BY is_default DESC, updated_at DESC`,
    )
    .all(ownerVisitorId) as AgentModelConfigRow[];
}

export function findAgentModelConfigById(
  db: Database.Database,
  id: string,
  ownerVisitorId: string,
): AgentModelConfigRow | undefined {
  return db
    .prepare(`SELECT * FROM agent_model_configs WHERE id = ? AND owner_visitor_id = ?`)
    .get(id, ownerVisitorId) as AgentModelConfigRow | undefined;
}

export function findDefaultAgentModelConfigByOwner(
  db: Database.Database,
  ownerVisitorId: string,
): AgentModelConfigRow | undefined {
  return (
    (db
      .prepare(
        `SELECT * FROM agent_model_configs
         WHERE owner_visitor_id = ? AND is_default = 1
         LIMIT 1`,
      )
      .get(ownerVisitorId) as AgentModelConfigRow | undefined) ??
    (db
      .prepare(
        `SELECT * FROM agent_model_configs
         WHERE owner_visitor_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(ownerVisitorId) as AgentModelConfigRow | undefined)
  );
}

export function countAgentModelConfigsByOwner(
  db: Database.Database,
  ownerVisitorId: string,
): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM agent_model_configs WHERE owner_visitor_id = ?`)
    .get(ownerVisitorId) as { c: number };
  return row.c;
}

export function insertAgentModelConfig(db: Database.Database, row: AgentModelConfigRow): void {
  db.prepare(
    `INSERT INTO agent_model_configs
       (id, owner_visitor_id, name, provider, kind, provider_id,
        base_url, api_type, compat_json, model_id, api_key, context_window, is_default, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
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
    row.is_default,
    row.updated_at,
  );
}

export function updateAgentModelConfig(db: Database.Database, row: AgentModelConfigRow): void {
  db.prepare(
    `UPDATE agent_model_configs SET
       name = ?, provider = ?, kind = ?, provider_id = ?,
       base_url = ?, api_type = ?, compat_json = ?, model_id = ?,
       api_key = ?, context_window = ?, is_default = ?, updated_at = ?
     WHERE id = ? AND owner_visitor_id = ?`,
  ).run(
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
    row.is_default,
    row.updated_at,
    row.id,
    row.owner_visitor_id,
  );
}

export function deleteAgentModelConfig(
  db: Database.Database,
  id: string,
  ownerVisitorId: string,
): boolean {
  const r = db
    .prepare(`DELETE FROM agent_model_configs WHERE id = ? AND owner_visitor_id = ?`)
    .run(id, ownerVisitorId);
  return r.changes > 0;
}

export function setDefaultAgentModelConfig(
  db: Database.Database,
  ownerVisitorId: string,
  configId: string,
): void {
  const tx = db.transaction(() => {
    db.prepare(`UPDATE agent_model_configs SET is_default = 0 WHERE owner_visitor_id = ?`).run(
      ownerVisitorId,
    );
    const r = db
      .prepare(
        `UPDATE agent_model_configs SET is_default = 1, updated_at = ?
         WHERE id = ? AND owner_visitor_id = ?`,
      )
      .run(new Date().toISOString(), configId, ownerVisitorId);
    if (r.changes === 0) throw new Error("config_not_found");
  });
  tx();
}
