import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../db/schema.js";
import { createDocument } from "../documents/document.service.js";
import { startIndexTimer, rebuildAllDirty } from "./document-index-manager.js";
import { searchDocuments } from "./search.service.js";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../storage/file-store.js", () => ({
  writeDocument: () => ({ contentHash: "mock-hash", bytes: 0 }),
  readDocument: () => ({ content: JSON.stringify({
    root: {
      children: [{
        children: [{ type: "text", text: "测试文档内容" }]
      }]
    }
  }), contentHash: "mock-hash" }),
  writeCommitBlob: () => ({ blobRef: "ab/mock", bytes: 0 }),
  readCommitBlob: () => "",
  deleteDocumentFile: () => {},
}));

vi.mock("../config/index.js", () => ({
  getConfig: () => ({
    host: "127.0.0.1",
    port: 4000,
    dataDir: "/tmp/mdocs-test",
    dbFile: "/tmp/mdocs-test/sqlite/data.sqlite",
    filesDir: "/tmp/mdocs-test/files",
    docsDir: "/tmp/mdocs-test/files/docs",
    assetsDir: "/tmp/mdocs-test/files/assets",
    logsDir: "/tmp/mdocs-test/logs",
    webDistDir: "/tmp/mdocs-test/web",
    logging: {
      level: "silent" as const,
      consoleLevel: "silent" as const,
      consoleStyle: "json" as const,
      retentionDays: 1,
      maxFileBytes: 1024,
    },
    defaultDomainId: "default",
  }),
}));

vi.mock("../logger/logger.js", () => ({
  useLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

describe("Search functionality", () => {
  beforeAll(() => {
    const db = new Database(":memory:");
    applySchema(db);
    testDbRef.db = db;
  });

  afterEach(() => {
    const db = testDbRef.db!;
    db.exec("DELETE FROM documents");
    db.exec("DELETE FROM documents_fts");
    db.exec("DELETE FROM documents_fts_rowid");
    db.exec("DELETE FROM audit_logs");
    db.exec("DELETE FROM document_invites");
  });

  it("should index documents and search works", async () => {
    // 创建测试文档
    createDocument({
      actorVisitorId: "test-actor",
      fileName: "test-document.md",
      displayName: "测试文档",
      content: "这是一个测试文档，包含了一些测试内容",
      domainId: "default",
      parentId: null,
    });

    // 强制索引构建
    await rebuildAllDirty();

    // 搜索文档
    const results = searchDocuments({
      query: "测试",
      visitorId: "test-actor",
      domainId: "default",
      topN: 10,
    });

    expect(results).toEqual([
      expect.objectContaining({
        documentId: expect.any(String),
        displayName: "测试文档",
        snippet: expect.any(String),
      }),
    ]);
  });

  it("should not find documents with no matching terms", async () => {
    // 创建测试文档
    createDocument({
      actorVisitorId: "test-actor",
      fileName: "another-test.md",
      displayName: "另一个测试文档",
      content: "这个文档包含了不同的内容",
      domainId: "default",
      parentId: null,
    });

    // 强制索引构建
    await rebuildAllDirty();

    // 搜索不存在的术语
    const results = searchDocuments({
      query: "不存在的术语",
      visitorId: "test-actor",
      domainId: "default",
      topN: 10,
    });

    expect(results).toEqual([]);
  });
});