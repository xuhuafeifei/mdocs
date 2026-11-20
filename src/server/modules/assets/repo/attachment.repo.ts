/**
 * attachments 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测 / 事务注入。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { Attachments } from "../entity/attachment.entity.js";

export type { Attachments } from "../entity/attachment.entity.js";

const COLUMNS = `attachment_id, document_id, relative_path, mime_type, byte_size,
  owner_visitor_id, created_at`;

/** 插入整行；主键是文本 attachment_id。 */
export function insertAttachment(
  row: Attachments,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO attachments (
        attachment_id, document_id, relative_path, mime_type, byte_size,
        owner_visitor_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.attachment_id,
      row.document_id,
      row.relative_path,
      row.mime_type,
      row.byte_size,
      row.owner_visitor_id,
      row.created_at,
    );
}

export function findAttachmentById(
  attachmentId: string,
  db?: Database.Database,
): Attachments | undefined {
  return resolveDb(db)
    .prepare<string, Attachments>(
      `SELECT ${COLUMNS} FROM attachments WHERE attachment_id = ?`,
    )
    .get(attachmentId);
}

export function countAttachmentsByOwner(
  ownerVisitorId: string,
  db?: Database.Database,
): number {
  const row = resolveDb(db)
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) AS c FROM attachments WHERE owner_visitor_id = ?`,
    )
    .get(ownerVisitorId);
  return row?.c ?? 0;
}

/** 访客迁移：把旧主人名下的附件全部改到新主人。 */
export function reassignAttachmentsOwner(
  fromVisitorId: string,
  toVisitorId: string,
  db?: Database.Database,
): number {
  const result = resolveDb(db)
    .prepare(
      `UPDATE attachments SET owner_visitor_id = ? WHERE owner_visitor_id = ?`,
    )
    .run(toVisitorId, fromVisitorId);
  return Number(result.changes ?? 0);
}
