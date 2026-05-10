import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { DocumentCommentRepository } from "../db/repositories/document-comment.repo.js";
import { DocumentCommentService } from "./document-comment.service.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE documents (
      document_id TEXT PRIMARY KEY,
      domain_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      display_name TEXT NOT NULL,
      owner_visitor_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      permission INTEGER NOT NULL DEFAULT 1,
      file_type TEXT NOT NULL DEFAULT 'md',
      parent_id TEXT
    );

    CREATE TABLE document_comments (
      comment_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      visitor_name TEXT NOT NULL,
      parent_id TEXT,
      reply_to_visitor_id TEXT,
      reply_to_visitor_name TEXT,
      content TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

describe("DocumentCommentService", () => {
  let db: Database.Database;
  let repo: DocumentCommentRepository;
  let service: DocumentCommentService;

  beforeEach(() => {
    db = createTestDb();
    repo = new DocumentCommentRepository(db);
    service = new DocumentCommentService(db);
  });

  describe("createComment", () => {
    it("应该能创建根评论", async () => {
      const comment = await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "这是一篇评论",
      });

      expect(comment.commentId).toBeTruthy();
      expect(comment.documentId).toBe("doc-1");
      expect(comment.visitorId).toBe("visitor-a");
      expect(comment.visitorName).toBe("Alice");
      expect(comment.content).toBe("这是一篇评论");
      expect(comment.parentId).toBeNull();
      expect(comment.isDeleted).toBe(false);
    });

    it("应该能回复根评论（两级结构）", async () => {
      // 先创建根评论
      const rootComment = await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "根评论",
      });

      // 回复根评论
      const reply = await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: rootComment.commentId,
        replyToVisitorId: "visitor-a",
        replyToVisitorName: "Alice",
        content: "回复根评论",
      });

      expect(reply.parentId).toBe(rootComment.commentId);
      expect(reply.replyToVisitorId).toBe("visitor-a");
      expect(reply.replyToVisitorName).toBe("Alice");
    });

    it("不允许回复非根评论（防止超过两级）", async () => {
      // 创建根评论
      const rootComment = await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "根评论",
      });

      // 创建回复
      const reply = await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: rootComment.commentId,
        replyToVisitorId: "visitor-a",
        replyToVisitorName: "Alice",
        content: "回复",
      });

      // 尝试回复回复（应该失败）
      await expect(
        service.createComment({
          documentId: "doc-1",
          visitorId: "visitor-c",
          visitorName: "Charlie",
          parentId: reply.commentId,
          replyToVisitorId: "visitor-b",
          replyToVisitorName: "Bob",
          content: "回复的回复",
        }),
      ).rejects.toThrow("只能回复根评论，不支持更深层级嵌套");
    });

    it("不允许创建空评论", async () => {
      await expect(
        service.createComment({
          documentId: "doc-1",
          visitorId: "visitor-a",
          visitorName: "Alice",
          parentId: null,
          replyToVisitorId: null,
          replyToVisitorName: null,
          content: "   ",
        }),
      ).rejects.toThrow("评论内容不能为空");
    });

    it("不允许创建超过 512 个字符的评论", async () => {
      const longContent = "a".repeat(513);
      await expect(
        service.createComment({
          documentId: "doc-1",
          visitorId: "visitor-a",
          visitorName: "Alice",
          parentId: null,
          replyToVisitorId: null,
          replyToVisitorName: null,
          content: longContent,
        }),
      ).rejects.toThrow("评论内容不能超过 512 个字符");
    });

    it("恰好 512 个字符的评论应该允许", async () => {
      const content = "a".repeat(512);
      const comment = await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content,
      });
      expect(comment.content.length).toBe(512);
    });
  });

  describe("deleteComment", () => {
    it("评论作者可以删除自己的评论", async () => {
      const comment = await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "我的评论",
      });

      const result = await service.deleteComment(comment.commentId, "visitor-a");
      expect(result).toBe(true);

      const deleted = await repo.getById(comment.commentId);
      expect(deleted?.isDeleted).toBe(true);
    });

    it("文档创建者可以删除该文档下的任意评论", async () => {
      // 先创建文档，owner 是 visitor-a
      db.prepare(`
        INSERT INTO documents (
          document_id, domain_id, relative_path, display_name,
          owner_visitor_id, created_by, updated_by, content_hash,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "doc-1",
        "default",
        "test.md",
        "Test",
        "visitor-a", // 文档创建者
        "visitor-a",
        "visitor-a",
        "hash",
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // visitor-b 发表评论
      const comment = await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "别人的评论",
      });

      // 文档创建者 visitor-a 可以删除 visitor-b 的评论
      const result = await service.deleteComment(comment.commentId, "visitor-a");
      expect(result).toBe(true);

      const deleted = await repo.getById(comment.commentId);
      expect(deleted?.isDeleted).toBe(true);
    });

    it("非作者且非文档创建者不能删除评论", async () => {
      // 创建文档，owner 是 visitor-a
      db.prepare(`
        INSERT INTO documents (
          document_id, domain_id, relative_path, display_name,
          owner_visitor_id, created_by, updated_by, content_hash,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "doc-1",
        "default",
        "test.md",
        "Test",
        "visitor-a",
        "visitor-a",
        "visitor-a",
        "hash",
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // visitor-b 发表评论
      const comment = await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "别人的评论",
      });

      // visitor-c 既不是作者也不是文档创建者，不能删除
      await expect(
        service.deleteComment(comment.commentId, "visitor-c"),
      ).rejects.toThrow("只能删除自己的评论或文档下的评论");
    });

    it("删除不存在的评论应该报错", async () => {
      await expect(
        service.deleteComment("non-existent-id", "visitor-a"),
      ).rejects.toThrow("评论不存在");
    });
  });

  describe("getCommentsByDocumentId", () => {
    it("应该能获取文档的所有评论", async () => {
      await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "评论 1",
      });

      await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "评论 2",
      });

      const comments = await service.getCommentsByDocumentId("doc-1");
      expect(comments.length).toBe(2);
      expect(comments.some((c) => c.content === "评论 1")).toBe(true);
      expect(comments.some((c) => c.content === "评论 2")).toBe(true);
    });

    it("获取不同文档的评论应该隔离", async () => {
      await service.createComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "文档 1 的评论",
      });

      await service.createComment({
        documentId: "doc-2",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "文档 2 的评论",
      });

      const comments1 = await service.getCommentsByDocumentId("doc-1");
      const comments2 = await service.getCommentsByDocumentId("doc-2");

      expect(comments1.length).toBe(1);
      expect(comments2.length).toBe(1);
      expect(comments1[0]!.content).toBe("文档 1 的评论");
      expect(comments2[0]!.content).toBe("文档 2 的评论");
    });
  });
});
