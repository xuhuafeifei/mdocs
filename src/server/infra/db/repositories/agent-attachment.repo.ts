import type Database from "better-sqlite3";

export type AgentAttachmentStatus = "staging" | "persisted";

export interface AgentAttachmentRow {
  attachment_id: string;
  owner_visitor_id: string;
  session_id: string;
  sha256: string;
  name: string;
  mime: string;
  byte_size: number;
  status: AgentAttachmentStatus;
  created_at: string;
  persisted_at: string | null;
}

export function insertAgentAttachment(
  db: Database.Database,
  row: AgentAttachmentRow,
): void {
  db.prepare(
    `INSERT INTO agent_attachments (
      attachment_id, owner_visitor_id, session_id, sha256, name, mime,
      byte_size, status, created_at, persisted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.attachment_id,
    row.owner_visitor_id,
    row.session_id,
    row.sha256,
    row.name,
    row.mime,
    row.byte_size,
    row.status,
    row.created_at,
    row.persisted_at,
  );
}

export function findAgentAttachmentById(
  db: Database.Database,
  attachmentId: string,
): AgentAttachmentRow | undefined {
  return db
    .prepare(`SELECT * FROM agent_attachments WHERE attachment_id = ?`)
    .get(attachmentId) as AgentAttachmentRow | undefined;
}

export function findAgentAttachmentsByIds(
  db: Database.Database,
  ownerVisitorId: string,
  sessionId: string,
  ids: string[],
): AgentAttachmentRow[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM agent_attachments
       WHERE owner_visitor_id = ? AND session_id = ?
         AND attachment_id IN (${placeholders})`,
    )
    .all(ownerVisitorId, sessionId, ...ids) as AgentAttachmentRow[];
  const byId = new Map(rows.map((r) => [r.attachment_id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is AgentAttachmentRow => !!r);
}

export function persistAgentAttachments(
  db: Database.Database,
  ownerVisitorId: string,
  sessionId: string,
  ids: string[],
  persistedAt: string,
): AgentAttachmentRow[] {
  if (ids.length === 0) return [];
  const tx = db.transaction(() => {
    const update = db.prepare(
      `UPDATE agent_attachments
       SET status = 'persisted', persisted_at = ?
       WHERE attachment_id = ? AND owner_visitor_id = ? AND session_id = ?
         AND status = 'staging'`,
    );
    for (const id of ids) {
      update.run(persistedAt, id, ownerVisitorId, sessionId);
    }
    return findAgentAttachmentsByIds(db, ownerVisitorId, sessionId, ids);
  });
  return tx();
}

export function deleteExpiredStagingAttachments(
  db: Database.Database,
  cutoffIso: string,
): string[] {
  const rows = db
    .prepare(
      `SELECT attachment_id FROM agent_attachments
       WHERE status = 'staging' AND created_at < ?`,
    )
    .all(cutoffIso) as { attachment_id: string }[];
  const ids = rows.map((r) => r.attachment_id);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(
    `DELETE FROM agent_attachments WHERE attachment_id IN (${placeholders})`,
  ).run(...ids);
  return ids;
}
