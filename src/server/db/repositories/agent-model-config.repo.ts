import type Database from "better-sqlite3";

export interface AgentModelConfigRow {
  id: string;
  owner_visitor_id: string;
  name: string;
  provider: string;
  model_id: string;
  api_key: string;
  context_window: number;
  updated_at: string;
}

export function findAgentModelConfigByOwner(
  db: Database.Database,
  ownerVisitorId: string,
): AgentModelConfigRow | undefined {
  const row = db
    .prepare(`SELECT * FROM agent_model_configs WHERE owner_visitor_id = ?`)
    .get(ownerVisitorId) as Partial<AgentModelConfigRow> | undefined;
  if (!row) return undefined;
  return {
    id: String(row.id),
    owner_visitor_id: String(row.owner_visitor_id),
    name: String(row.name),
    provider: String(row.provider),
    model_id: String(row.model_id),
    api_key: String(row.api_key),
    context_window:
      typeof row.context_window === "number" && row.context_window > 0
        ? row.context_window
        : 128000,
    updated_at: String(row.updated_at),
  };
}

export function upsertAgentModelConfig(
  db: Database.Database,
  row: AgentModelConfigRow,
): void {
  db.prepare(
    `INSERT INTO agent_model_configs
       (id, owner_visitor_id, name, provider, model_id, api_key, context_window, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_visitor_id) DO UPDATE SET
       name = excluded.name,
       provider = excluded.provider,
       model_id = excluded.model_id,
       api_key = excluded.api_key,
       context_window = excluded.context_window,
       updated_at = excluded.updated_at`,
  ).run(
    row.id,
    row.owner_visitor_id,
    row.name,
    row.provider,
    row.model_id,
    row.api_key,
    row.context_window,
    row.updated_at,
  );
}
