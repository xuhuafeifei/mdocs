import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";
import { applySchema } from "../db/schema.js";
import { createDocument } from "../documents/document.service.js";
import { Permission } from "../access/access-control.js";
import { rebuildAllDirty, removeIndex, rebuildDocument } from "./document-index-manager.js";
import { searchDocuments } from "./search.service.js";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));
const contentByPath = vi.hoisted(() => new Map<string, string>());

const JIEBA = Jieba.withDict(dict);
function tok(text: string): string {
  return JIEBA.cutForSearch(text, true).join(" ");
}

function lexical(text: string): string {
  return JSON.stringify({
    root: {
      children: [{ children: [{ type: "text", text }] }],
    },
  });
}

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../storage/file-store.js", () => ({
  writeDocument: () => ({ contentHash: "mock-hash", bytes: 0 }),
  readDocument: (_domainId: string, relativePath: string) => ({
    content: contentByPath.get(relativePath) ?? lexical("测试文档内容"),
    contentHash: "mock-hash",
  }),
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

/** 本文件测 FTS；语义路 no-op，避免拉 GGUF */
vi.mock("./embedding-store.js", () => ({
  deleteEmbeddingChunks: () => {},
  upsertDocumentEmbeddings: async () => {},
  querySemanticNeighbors: async () => [],
}));

function insertFtsDoc(opts: {
  documentId: string;
  domainId: string;
  displayName: string;
  relativePath: string;
  ownerVisitorId: string;
  permission: number;
  title?: string;
  body?: string;
}): void {
  const db = testDbRef.db!;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO documents (
      document_id, domain_id, relative_path, display_name, owner_visitor_id,
      created_by, updated_by, content_hash, created_at, updated_at, permission, file_type, is_dirty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'md', 0)`,
  ).run(
    opts.documentId,
    opts.domainId,
    opts.relativePath,
    opts.displayName,
    opts.ownerVisitorId,
    opts.ownerVisitorId,
    opts.ownerVisitorId,
    "hash",
    now,
    now,
    opts.permission,
  );

  if (opts.title !== undefined) {
    const r = db
      .prepare(
        `INSERT INTO documents_fts_title(title, document_id, display_name, relative_path, domain_id, owner_visitor_id, permission)
         VALUES(?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        tok(opts.title),
        opts.documentId,
        opts.displayName,
        opts.relativePath,
        opts.domainId,
        opts.ownerVisitorId,
        opts.permission,
      );
    db.prepare(`INSERT INTO documents_fts_title_rowid(document_id, fts_rowid) VALUES(?, ?)`).run(
      opts.documentId,
      r.lastInsertRowid,
    );
  }

  if (opts.body !== undefined) {
    const r = db
      .prepare(
        `INSERT INTO documents_fts(content, document_id, display_name, relative_path, domain_id, owner_visitor_id, permission)
         VALUES(?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        tok(opts.body),
        opts.documentId,
        opts.displayName,
        opts.relativePath,
        opts.domainId,
        opts.ownerVisitorId,
        opts.permission,
      );
    db.prepare(`INSERT INTO documents_fts_rowid(document_id, fts_rowid) VALUES(?, ?)`).run(
      opts.documentId,
      r.lastInsertRowid,
    );
  }
}

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
    db.exec("DELETE FROM documents_fts_title");
    db.exec("DELETE FROM documents_fts_title_rowid");
    db.exec("DELETE FROM document_embedding_chunks");
    db.exec("DELETE FROM audit_logs");
    db.exec("DELETE FROM document_invites");
    contentByPath.clear();
  });

  it("should index documents and search works", async () => {
    createDocument({
      actorVisitorId: "test-actor",
      fileName: "test-document.md",
      displayName: "测试文档",
      content: "这是一个测试文档，包含了一些测试内容",
      domainId: "default",
      parentId: null,
    });

    await rebuildAllDirty();

    const results = await searchDocuments({
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
    createDocument({
      actorVisitorId: "test-actor",
      fileName: "another-test.md",
      displayName: "另一个测试文档",
      content: "这个文档包含了不同的内容",
      domainId: "default",
      parentId: null,
    });

    await rebuildAllDirty();

    const results = await searchDocuments({
      query: "不存在的术语",
      visitorId: "test-actor",
      domainId: "default",
      topN: 10,
    });

    expect(results).toEqual([]);
  });

  it("title-only hit ranks and returns displayName snippet", async () => {
    insertFtsDoc({
      documentId: "title-only",
      domainId: "default",
      displayName: "恢复码说明",
      relativePath: "recovery.md",
      ownerVisitorId: "owner-a",
      permission: Permission.PUBLIC_READ,
      title: "恢复码说明",
      body: "完全无关的正文内容",
    });

    const results = await searchDocuments({
      query: "恢复码",
      visitorId: "anyone",
      domainId: "default",
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.documentId).toBe("title-only");
    expect(results[0]!.snippet).toBe("恢复码说明");
  });

  it("body-only hit still works", async () => {
    insertFtsDoc({
      documentId: "body-only",
      domainId: "default",
      displayName: "普通标题",
      relativePath: "body.md",
      ownerVisitorId: "owner-a",
      permission: Permission.PUBLIC_READ,
      title: "普通标题",
      body: "文中提到了向量检索算法",
    });

    const results = await searchDocuments({
      query: "向量检索",
      visitorId: "anyone",
      domainId: "default",
    });

    expect(results.map((r) => r.documentId)).toEqual(["body-only"]);
  });

  it("title strong hit ranks above body weak hit", async () => {
    insertFtsDoc({
      documentId: "by-title",
      domainId: "default",
      displayName: "恢复码",
      relativePath: "t.md",
      ownerVisitorId: "owner-a",
      permission: Permission.PUBLIC_READ,
      title: "恢复码",
      body: "无关正文 aaa bbb ccc",
    });
    insertFtsDoc({
      documentId: "by-body",
      domainId: "default",
      displayName: "别的文档",
      relativePath: "b.md",
      ownerVisitorId: "owner-a",
      permission: Permission.PUBLIC_READ,
      title: "别的文档",
      body: "这里偶尔提到恢复码一次而已",
    });

    const results = await searchDocuments({
      query: "恢复码",
      visitorId: "anyone",
      domainId: "default",
    });

    expect(results.map((r) => r.documentId)).toEqual(["by-title", "by-body"]);
    expect(results[0]!.bm25Score).toBeGreaterThan(results[1]!.bm25Score);
  });

  it("domainId filters both title and body paths", async () => {
    insertFtsDoc({
      documentId: "in-a",
      domainId: "default",
      displayName: "共享词",
      relativePath: "a.md",
      ownerVisitorId: "owner-a",
      permission: Permission.PUBLIC_READ,
      title: "共享词",
      body: "共享词正文",
    });

    const now = new Date().toISOString();
    testDbRef.db!.prepare(
      `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("domain-b", "B", "system", now, now, "public");

    insertFtsDoc({
      documentId: "in-b",
      domainId: "domain-b",
      displayName: "共享词",
      relativePath: "b.md",
      ownerVisitorId: "owner-a",
      permission: Permission.PUBLIC_READ,
      title: "共享词",
      body: "共享词正文",
    });

    const results = await searchDocuments({
      query: "共享词",
      visitorId: "anyone",
      domainId: "default",
    });

    expect(results.map((r) => r.documentId)).toEqual(["in-a"]);
  });

  it("private docs are filtered by canReadDocument", async () => {
    const now = new Date().toISOString();
    testDbRef.db!.prepare(
      `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("priv-domain", "Private", "owner-a", now, now, "private");

    insertFtsDoc({
      documentId: "secret",
      domainId: "priv-domain",
      displayName: "机密恢复码",
      relativePath: "secret.md",
      ownerVisitorId: "owner-a",
      permission: Permission.PRIVATE,
      title: "机密恢复码",
      body: "机密正文",
    });

    expect(
      await searchDocuments({ query: "恢复码", visitorId: "stranger", domainId: "priv-domain" }),
    ).toEqual([]);

    expect(
      (await searchDocuments({ query: "恢复码", visitorId: "owner-a", domainId: "priv-domain" })).map(
        (r) => r.documentId,
      ),
    ).toEqual(["secret"]);
  });

  it("rename rebuild updates title index", async () => {
    contentByPath.set("rename.md", lexical("无关正文"));
    const created = createDocument({
      actorVisitorId: "test-actor",
      fileName: "rename.md",
      displayName: "旧标题词",
      content: "无关正文",
      domainId: "default",
      parentId: null,
    });

    await rebuildAllDirty();
    expect(
      await searchDocuments({ query: "旧标题词", visitorId: "test-actor", domainId: "default" }),
    ).toHaveLength(1);

    testDbRef.db!.prepare(
      `UPDATE documents SET display_name = ?, is_dirty = 1, updated_at = ? WHERE document_id = ?`,
    ).run("新标题词", new Date().toISOString(), created.documentId);

    rebuildDocument(created.documentId);

    expect(
      await searchDocuments({ query: "旧标题词", visitorId: "test-actor", domainId: "default" }),
    ).toEqual([]);
    expect(
      (await searchDocuments({ query: "新标题词", visitorId: "test-actor", domainId: "default" })).map(
        (r) => r.documentId,
      ),
    ).toEqual([created.documentId]);
  });

  it("removeIndex clears both fts paths", async () => {
    contentByPath.set("gone.md", lexical("正文里有独有词xyzabc"));
    const created = createDocument({
      actorVisitorId: "test-actor",
      fileName: "gone.md",
      displayName: "独有标题词xyzabc",
      content: "正文里有独有词xyzabc",
      domainId: "default",
      parentId: null,
    });
    await rebuildAllDirty();
    // createDocument 会 nextTick 再 rebuild；先冲掉，避免 remove 后又被写回
    await new Promise<void>((resolve) => process.nextTick(resolve));

    removeIndex(created.documentId);
    testDbRef.db!.prepare(`DELETE FROM documents WHERE document_id = ?`).run(created.documentId);

    expect(
      await searchDocuments({ query: "xyzabc", visitorId: "test-actor", domainId: "default" }),
    ).toEqual([]);
  });
});
