import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  createDocumentComment,
  deleteDocumentComment,
  listDocumentComments,
} from "./application/document-comments.application.js";
import { findDocumentCommentById } from "./repo/document-comment.repo.js";

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
      head_commit_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      permission INTEGER NOT NULL DEFAULT 1,
      file_type TEXT NOT NULL DEFAULT 'md',
      parent_id TEXT,
      is_dirty INTEGER NOT NULL DEFAULT 1
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

function insertDocument(db: Database.Database, ownerVisitorId: string): void {
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
    ownerVisitorId,
    ownerVisitorId,
    ownerVisitorId,
    "hash",
    new Date().toISOString(),
    new Date().toISOString(),
  );
}

describe("document comments", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("createDocumentComment", () => {
    it("应该能创建根评论", () => {
      const comment = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "这是一篇评论",
      }, db);

      expect(comment.commentId).toBeTruthy();
      expect(comment.documentId).toBe("doc-1");
      expect(comment.visitorId).toBe("visitor-a");
      expect(comment.visitorName).toBe("Alice");
      expect(comment.content).toBe("这是一篇评论");
      expect(comment.parentId).toBeNull();
      expect(comment.isDeleted).toBe(false);

      const stored = findDocumentCommentById(comment.commentId, db);
      expect(stored?.is_deleted).toBe(0);
      expect(stored?.visitor_id).toBe("visitor-a");
    });

    it("应该能回复根评论（两级结构）", () => {
      const rootComment = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "根评论",
      }, db);

      const reply = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: rootComment.commentId,
        replyToVisitorId: "visitor-a",
        replyToVisitorName: "Alice",
        content: "回复根评论",
      }, db);

      expect(reply.parentId).toBe(rootComment.commentId);
      expect(reply.replyToVisitorId).toBe("visitor-a");
      expect(reply.replyToVisitorName).toBe("Alice");
    });

    it("不允许回复非根评论（防止超过两级）", () => {
      const rootComment = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "根评论",
      }, db);

      const reply = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: rootComment.commentId,
        replyToVisitorId: "visitor-a",
        replyToVisitorName: "Alice",
        content: "回复",
      }, db);

      expect(() =>
        createDocumentComment({
          documentId: "doc-1",
          visitorId: "visitor-c",
          visitorName: "Charlie",
          parentId: reply.commentId,
          replyToVisitorId: "visitor-b",
          replyToVisitorName: "Bob",
          content: "回复的回复",
        }, db),
      ).toThrow("只能回复根评论，不支持更深层级嵌套");
    });

    it("不允许创建空评论", () => {
      expect(() =>
        createDocumentComment({
          documentId: "doc-1",
          visitorId: "visitor-a",
          visitorName: "Alice",
          parentId: null,
          replyToVisitorId: null,
          replyToVisitorName: null,
          content: "   ",
        }, db),
      ).toThrow("评论内容不能为空");
    });

    it("不允许创建超过 512 个字符的评论", () => {
      const longContent = "a".repeat(513);
      expect(() =>
        createDocumentComment({
          documentId: "doc-1",
          visitorId: "visitor-a",
          visitorName: "Alice",
          parentId: null,
          replyToVisitorId: null,
          replyToVisitorName: null,
          content: longContent,
        }, db),
      ).toThrow("评论内容不能超过 512 个字符");
    });

    it("恰好 512 个字符的评论应该允许", () => {
      const content = "a".repeat(512);
      const comment = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content,
      }, db);
      expect(comment.content.length).toBe(512);
    });
  });

  describe("deleteDocumentComment", () => {
    it("评论作者可以删除自己的评论", () => {
      const comment = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "我的评论",
      }, db);

      const result = deleteDocumentComment(comment.commentId, "visitor-a", db);
      expect(result.success).toBe(true);

      const deleted = findDocumentCommentById(comment.commentId, db);
      expect(deleted?.is_deleted).toBe(1);
    });

    it("文档创建者可以删除该文档下的任意评论", () => {
      insertDocument(db, "visitor-a");

      const comment = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "别人的评论",
      }, db);

      const result = deleteDocumentComment(comment.commentId, "visitor-a", db);
      expect(result.success).toBe(true);

      const deleted = findDocumentCommentById(comment.commentId, db);
      expect(deleted?.is_deleted).toBe(1);
    });

    it("非作者且非文档创建者不能删除评论", () => {
      insertDocument(db, "visitor-a");

      const comment = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "别人的评论",
      }, db);

      expect(() => deleteDocumentComment(comment.commentId, "visitor-c", db)).toThrow(
        "只能删除自己的评论或文档下的评论",
      );
    });

    it("删除不存在的评论应该报错", () => {
      expect(() => deleteDocumentComment("non-existent-id", "visitor-a", db)).toThrow("评论不存在");
    });
  });

  describe("listDocumentComments", () => {
    it("应该能获取文档的所有评论", () => {
      createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "评论 1",
      }, db);

      createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "评论 2",
      }, db);

      const { comments } = listDocumentComments("doc-1", db);
      expect(comments.length).toBe(2);
      expect(comments.some((c) => c.content === "评论 1")).toBe(true);
      expect(comments.some((c) => c.content === "评论 2")).toBe(true);
    });

    it("获取不同文档的评论应该隔离", () => {
      createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "文档 1 的评论",
      }, db);

      createDocumentComment({
        documentId: "doc-2",
        visitorId: "visitor-b",
        visitorName: "Bob",
        parentId: null,
        replyToVisitorId: null,
        replyToVisitorName: null,
        content: "文档 2 的评论",
      }, db);

      const comments1 = listDocumentComments("doc-1", db).comments;
      const comments2 = listDocumentComments("doc-2", db).comments;

      expect(comments1.length).toBe(1);
      expect(comments2.length).toBe(1);
      expect(comments1[0]!.content).toBe("文档 1 的评论");
      expect(comments2[0]!.content).toBe("文档 2 的评论");
    });

    it("total 不计入已软删评论", () => {
      const comment = createDocumentComment({
        documentId: "doc-1",
        visitorId: "visitor-a",
        visitorName: "Alice",
        content: "待删",
      }, db);
      deleteDocumentComment(comment.commentId, "visitor-a", db);

      const listed = listDocumentComments("doc-1", db);
      expect(listed.comments).toHaveLength(1);
      expect(listed.comments[0]!.isDeleted).toBe(true);
      expect(listed.total).toBe(0);
    });
  });
});
