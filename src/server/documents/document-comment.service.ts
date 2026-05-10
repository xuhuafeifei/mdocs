import type Database from "better-sqlite3";
import { getDb } from "../db/connection.js";
import { DocumentCommentRepository } from "../db/repositories/document-comment.repo.js";

export class DocumentCommentService {
  private readonly repo: DocumentCommentRepository;
  private readonly db: Database.Database;

  constructor(db = getDb()) {
    this.db = db;
    this.repo = new DocumentCommentRepository(db);
  }

  /** 创建评论 */
  async createComment(params: {
    documentId: string;
    visitorId: string;
    visitorName: string;
    parentId: string | null;
    replyToVisitorId: string | null;
    replyToVisitorName: string | null;
    content: string;
  }) {
    // 校验：如果有 parentId，必须是根评论（保证两层结构）
    if (params.parentId) {
      const isRoot = await this.repo.isRootComment(params.parentId);
      if (!isRoot) {
        throw new Error("只能回复根评论，不支持更深层级嵌套");
      }
    }

    if (!params.content.trim()) {
      throw new Error("评论内容不能为空");
    }

    if (params.content.length > 512) {
      throw new Error("评论内容不能超过 512 个字符");
    }

    return this.repo.create(params);
  }

  /** 获取文档的所有评论 */
  async getCommentsByDocumentId(documentId: string) {
    return this.repo.getByDocumentId(documentId);
  }

  /** 删除评论（软删除）
   * - 评论作者可以删除自己的评论
   * - 文档创建者可以删除该文档下的所有评论
   */
  async deleteComment(commentId: string, visitorId: string) {
    const comment = await this.repo.getById(commentId);
    if (!comment) {
      throw new Error("评论不存在");
    }

    // 获取文档信息，检查是否是文档创建者
    const doc = this.db
      .prepare("SELECT owner_visitor_id FROM documents WHERE document_id = ?")
      .get(comment.documentId) as { owner_visitor_id: string } | undefined;

    const isDocOwner = doc && doc.owner_visitor_id === visitorId;
    const isCommentAuthor = comment.visitorId === visitorId;

    // 只有评论作者或文档创建者可以删除
    if (!isCommentAuthor && !isDocOwner) {
      throw new Error("只能删除自己的评论或文档下的评论");
    }

    return this.repo.softDelete(commentId);
  }

  /** 获取文档评论数 */
  async countComments(documentId: string) {
    return this.repo.countByDocumentId(documentId);
  }
}

export const documentCommentService = new DocumentCommentService();
