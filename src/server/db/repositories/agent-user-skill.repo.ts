import type Database from "better-sqlite3";

export interface AgentUserSkillRow {
  id: string;
  owner_visitor_id: string;
  name: string;
  description: string;
  body: string;
  updated_at: string;
}

export function listAgentUserSkillsByOwner(
  db: Database.Database,
  ownerVisitorId: string,
): AgentUserSkillRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM agent_user_skills
       WHERE owner_visitor_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(ownerVisitorId) as AgentUserSkillRow[];
  return rows.map(normalizeRow);
}

export function findAgentUserSkillById(
  db: Database.Database,
  id: string,
  ownerVisitorId: string,
): AgentUserSkillRow | undefined {
  const row = db
    .prepare(
      `SELECT * FROM agent_user_skills WHERE id = ? AND owner_visitor_id = ?`,
    )
    .get(id, ownerVisitorId) as AgentUserSkillRow | undefined;
  return row ? normalizeRow(row) : undefined;
}

export function findAgentUserSkillByName(
  db: Database.Database,
  ownerVisitorId: string,
  name: string,
): AgentUserSkillRow | undefined {
  const row = db
    .prepare(
      `SELECT * FROM agent_user_skills WHERE owner_visitor_id = ? AND name = ?`,
    )
    .get(ownerVisitorId, name) as AgentUserSkillRow | undefined;
  return row ? normalizeRow(row) : undefined;
}

export function findAgentUserSkillsByNames(
  db: Database.Database,
  ownerVisitorId: string,
  names: string[],
): AgentUserSkillRow[] {
  if (names.length === 0) return [];
  const placeholders = names.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM agent_user_skills
       WHERE owner_visitor_id = ? AND name IN (${placeholders})`,
    )
    .all(ownerVisitorId, ...names) as AgentUserSkillRow[];
  const byName = new Map(rows.map((r) => [r.name, normalizeRow(r)]));
  return names.map((n) => byName.get(n)).filter((r): r is AgentUserSkillRow => !!r);
}

export function findAgentUserSkillsByIds(
  db: Database.Database,
  ownerVisitorId: string,
  ids: string[],
): AgentUserSkillRow[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM agent_user_skills
       WHERE owner_visitor_id = ? AND id IN (${placeholders})`,
    )
    .all(ownerVisitorId, ...ids) as AgentUserSkillRow[];
  const byId = new Map(rows.map((r) => [r.id, normalizeRow(r)]));
  return ids.map((id) => byId.get(id)).filter((r): r is AgentUserSkillRow => !!r);
}

export function deleteAgentUserSkillByName(
  db: Database.Database,
  ownerVisitorId: string,
  name: string,
): boolean {
  const result = db
    .prepare(`DELETE FROM agent_user_skills WHERE owner_visitor_id = ? AND name = ?`)
    .run(ownerVisitorId, name);
  return result.changes > 0;
}

export function insertAgentUserSkill(db: Database.Database, row: AgentUserSkillRow): void {
  db.prepare(
    `INSERT INTO agent_user_skills
       (id, owner_visitor_id, name, description, body, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.owner_visitor_id,
    row.name,
    row.description,
    row.body,
    row.updated_at,
  );
}

export function updateAgentUserSkill(
  db: Database.Database,
  row: Pick<AgentUserSkillRow, "id" | "owner_visitor_id" | "name" | "description" | "body" | "updated_at">,
): boolean {
  const result = db
    .prepare(
      `UPDATE agent_user_skills
       SET name = ?, description = ?, body = ?, updated_at = ?
       WHERE id = ? AND owner_visitor_id = ?`,
    )
    .run(
      row.name,
      row.description,
      row.body,
      row.updated_at,
      row.id,
      row.owner_visitor_id,
    );
  return result.changes > 0;
}

export function deleteAgentUserSkill(
  db: Database.Database,
  id: string,
  ownerVisitorId: string,
): boolean {
  const result = db
    .prepare(`DELETE FROM agent_user_skills WHERE id = ? AND owner_visitor_id = ?`)
    .run(id, ownerVisitorId);
  return result.changes > 0;
}

function normalizeRow(row: AgentUserSkillRow): AgentUserSkillRow {
  return {
    id: String(row.id),
    owner_visitor_id: String(row.owner_visitor_id),
    name: String(row.name),
    description: typeof row.description === "string" ? row.description : "",
    body: String(row.body),
    updated_at: String(row.updated_at),
  };
}
