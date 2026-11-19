/**
 * document_comments 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 * 入参/返回均为表实体；不做 HTTP 映射。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { DocumentComments } from "../entity/document-comment.entity.js";

export type { DocumentComments } from "../entity/document-comment.entity.js";

const COMMENT_COLUMNS = `comment_id, document_id, visitor_id, visitor_name,
  parent_id, reply_to_visitor_id, reply_to_visitor_name,
  content, is_deleted, created_at, updated_at`;

export function insertDocumentComment(
  input: DocumentComments,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO document_comments (
        comment_id, document_id, visitor_id, visitor_name,
        parent_id, reply_to_visitor_id, reply_to_visitor_name,
        content, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.comment_id,
      input.document_id,
      input.visitor_id,
      input.visitor_name,
      input.parent_id,
      input.reply_to_visitor_id,
      input.reply_to_visitor_name,
      input.content,
      input.is_deleted,
      input.created_at,
      input.updated_at,
    );
}

export function findDocumentCommentById(
  commentId: string,
  db?: Database.Database,
): DocumentComments | undefined {
  return resolveDb(db)
    .prepare<string, DocumentComments>(
      `SELECT ${COMMENT_COLUMNS} FROM document_comments WHERE comment_id = ?`,
    )
    .get(commentId);
}

export function listCommentsByDocumentId(
  documentId: string,
  db?: Database.Database,
): DocumentComments[] {
  return resolveDb(db)
    .prepare<string, DocumentComments>(
      `SELECT ${COMMENT_COLUMNS}
       FROM document_comments
       WHERE document_id = ?
       ORDER BY created_at ASC`,
    )
    .all(documentId);
}

export function markDocumentCommentDeleted(
  commentId: string,
  updatedAt: string,
  db?: Database.Database,
): boolean {
  const result = resolveDb(db)
    .prepare(
      `UPDATE document_comments SET is_deleted = 1, updated_at = ? WHERE comment_id = ?`,
    )
    .run(updatedAt, commentId);
  return (result.changes || 0) > 0;
}
