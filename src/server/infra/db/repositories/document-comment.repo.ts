import type Database from "better-sqlite3";
import { randomUUID } from "crypto";

export interface DocumentComment {
  commentId: string;
  documentId: string;
  visitorId: string;
  visitorName: string;
  parentId: string | null;
  replyToVisitorId: string | null;
  replyToVisitorName: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export class DocumentCommentRepository {
  constructor(private readonly db: Database.Database) {}

  /** 创建评论 */
  async create(params: {
    documentId: string;
    visitorId: string;
    visitorName: string;
    parentId: string | null;
    replyToVisitorId: string | null;
    replyToVisitorName: string | null;
    content: string;
  }): Promise<DocumentComment> {
    const now = new Date().toISOString();
    const commentId = randomUUID();

    this.db
      .prepare(
        `INSERT INTO document_comments (
          comment_id, document_id, visitor_id, visitor_name,
          parent_id, reply_to_visitor_id, reply_to_visitor_name,
          content, is_deleted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        commentId,
        params.documentId,
        params.visitorId,
        params.visitorName,
        params.parentId,
        params.replyToVisitorId,
        params.replyToVisitorName,
        params.content,
        now,
        now,
      );

    return this.getById(commentId) as Promise<DocumentComment>;
  }

  /** 根据 ID 获取评论 */
  async getById(commentId: string): Promise<DocumentComment | null> {
    const row = this.db
      .prepare(
        `SELECT
          comment_id as commentId,
          document_id as documentId,
          visitor_id as visitorId,
          visitor_name as visitorName,
          parent_id as parentId,
          reply_to_visitor_id as replyToVisitorId,
          reply_to_visitor_name as replyToVisitorName,
          content,
          is_deleted as isDeleted,
          created_at as createdAt,
          updated_at as updatedAt
        FROM document_comments
        WHERE comment_id = ?`,
      )
      .get(commentId) as any;

    return row ? { ...row, isDeleted: Boolean(row.isDeleted) } : null;
  }

  /** 获取文档的所有评论 */
  async getByDocumentId(documentId: string): Promise<DocumentComment[]> {
    const rows = this.db
      .prepare(
        `SELECT
          comment_id as commentId,
          document_id as documentId,
          visitor_id as visitorId,
          visitor_name as visitorName,
          parent_id as parentId,
          reply_to_visitor_id as replyToVisitorId,
          reply_to_visitor_name as replyToVisitorName,
          content,
          is_deleted as isDeleted,
          created_at as createdAt,
          updated_at as updatedAt
        FROM document_comments
        WHERE document_id = ?
        ORDER BY created_at ASC`,
      )
      .all(documentId) as any[];

    return rows.map((r) => ({ ...r, isDeleted: Boolean(r.isDeleted) }));
  }

  /** 获取某根评论的所有回复 */
  async getReplies(parentId: string): Promise<DocumentComment[]> {
    const rows = this.db
      .prepare(
        `SELECT
          comment_id as commentId,
          document_id as documentId,
          visitor_id as visitorId,
          visitor_name as visitorName,
          parent_id as parentId,
          reply_to_visitor_id as replyToVisitorId,
          reply_to_visitor_name as replyToVisitorName,
          content,
          is_deleted as isDeleted,
          created_at as createdAt,
          updated_at as updatedAt
        FROM document_comments
        WHERE parent_id = ?
        ORDER BY created_at ASC`,
      )
      .all(parentId) as any[];

    return rows.map((r) => ({ ...r, isDeleted: Boolean(r.isDeleted) }));
  }

  /** 软删除评论 */
  async softDelete(commentId: string): Promise<boolean> {
    const result = this.db
      .prepare(`UPDATE document_comments SET is_deleted = 1, updated_at = ? WHERE comment_id = ?`)
      .run(new Date().toISOString(), commentId);

    return (result.changes || 0) > 0;
  }

  /** 检查是否为根评论（用于校验两层结构约束） */
  async isRootComment(commentId: string): Promise<boolean> {
    const row = this.db
      .prepare(`SELECT parent_id FROM document_comments WHERE comment_id = ?`)
      .get(commentId) as { parent_id: string | null } | undefined;

    return row?.parent_id == null;
  }

  /** 获取文档评论数 */
  async countByDocumentId(documentId: string): Promise<number> {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM document_comments WHERE document_id = ? AND is_deleted = 0`)
      .get(documentId) as { count: number };

    return row.count;
  }
}
