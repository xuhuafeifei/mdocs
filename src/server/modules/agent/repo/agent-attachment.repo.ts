/**
 * agent_attachments 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { AgentAttachments } from "../entity/agent-attachment.entity.js";

export type { AgentAttachments } from "../entity/agent-attachment.entity.js";

const COLUMNS = `attachment_id, owner_visitor_id, session_id, sha256, name, mime,
  byte_size, status, created_at, persisted_at`;

export function insertAgentAttachment(
  row: AgentAttachments,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO agent_attachments (
        attachment_id, owner_visitor_id, session_id, sha256, name, mime,
        byte_size, status, created_at, persisted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
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
  attachmentId: string,
  db?: Database.Database,
): AgentAttachments | undefined {
  return resolveDb(db)
    .prepare<string, AgentAttachments>(
      `SELECT ${COLUMNS} FROM agent_attachments WHERE attachment_id = ?`,
    )
    .get(attachmentId);
}

export function findAgentAttachmentsByIds(
  ownerVisitorId: string,
  sessionId: string,
  ids: string[],
  db?: Database.Database,
): AgentAttachments[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = resolveDb(db)
    .prepare(
      `SELECT ${COLUMNS} FROM agent_attachments
       WHERE owner_visitor_id = ? AND session_id = ?
         AND attachment_id IN (${placeholders})`,
    )
    .all(ownerVisitorId, sessionId, ...ids) as AgentAttachments[];
  const byId = new Map(rows.map((row) => [row.attachment_id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is AgentAttachments => !!row);
}

export function persistAgentAttachments(
  ownerVisitorId: string,
  sessionId: string,
  ids: string[],
  persistedAt: string,
  db?: Database.Database,
): AgentAttachments[] {
  if (ids.length === 0) return [];
  const conn = resolveDb(db);
  const tx = conn.transaction(() => {
    const update = conn.prepare(
      `UPDATE agent_attachments
       SET status = 'persisted', persisted_at = ?
       WHERE attachment_id = ? AND owner_visitor_id = ? AND session_id = ?
         AND status = 'staging'`,
    );
    for (const id of ids) {
      update.run(persistedAt, id, ownerVisitorId, sessionId);
    }
    return findAgentAttachmentsByIds(ownerVisitorId, sessionId, ids, conn);
  });
  return tx();
}

export function deleteExpiredStagingAttachments(
  cutoffIso: string,
  db?: Database.Database,
): string[] {
  const conn = resolveDb(db);
  const rows = conn
    .prepare<string, { attachment_id: string }>(
      `SELECT attachment_id FROM agent_attachments
       WHERE status = 'staging' AND created_at < ?`,
    )
    .all(cutoffIso);
  const ids = rows.map((row) => row.attachment_id);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  conn.prepare(`DELETE FROM agent_attachments WHERE attachment_id IN (${placeholders})`).run(...ids);
  return ids;
}
