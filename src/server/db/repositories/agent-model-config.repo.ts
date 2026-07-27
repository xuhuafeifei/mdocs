import type Database from "better-sqlite3";

export interface AgentModelConfigRow {
  id: string;
  owner_visitor_id: string;
  name: string;
  provider: string;
  model_id: string;
  api_key: string;
  updated_at: string;
}

export function findAgentModelConfigByOwner(
  db: Database.Database,
  ownerVisitorId: string,
): AgentModelConfigRow | undefined {
  return db
    .prepare(`SELECT * FROM agent_model_configs WHERE owner_visitor_id = ?`)
    .get(ownerVisitorId) as AgentModelConfigRow | undefined;
}

export function upsertAgentModelConfig(
  db: Database.Database,
  row: AgentModelConfigRow,
): void {
  db.prepare(
    `INSERT INTO agent_model_configs
       (id, owner_visitor_id, name, provider, model_id, api_key, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_visitor_id) DO UPDATE SET
       name = excluded.name,
       provider = excluded.provider,
       model_id = excluded.model_id,
       api_key = excluded.api_key,
       updated_at = excluded.updated_at`,
  ).run(
    row.id,
    row.owner_visitor_id,
    row.name,
    row.provider,
    row.model_id,
    row.api_key,
    row.updated_at,
  );
}
