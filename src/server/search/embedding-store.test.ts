/**
 * 语义索引：切块 / cosine / 合并降级（stub 向量，不加载 GGUF）。
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";
import { applySchema } from "../db/schema.js";
import { Permission } from "../access/access-control.js";
import { searchDocuments, tokenizeQuery } from "./search.service.js";
import {
  blobToFloat32,
  chunkPlainText,
  cosineSimilarity,
  deleteEmbeddingChunks,
  float32ToBlob,
} from "./embedding-store.js";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));
const embedState = vi.hoisted(() => ({
  ready: true,
  /** docId → 固定向量（模拟不同语义） */
  vectors: new Map<string, Float32Array>(),
  queryVec: null as Float32Array | null,
}));

const JIEBA = Jieba.withDict(dict);
function tok(text: string): string {
  return JIEBA.cutForSearch(text, true).join(" ");
}

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../logger/logger.js", () => ({
  useLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

vi.mock("./embedding-model.js", () => ({
  EMBEDDING_DIM: 8,
  isEmbeddingReady: () => embedState.ready,
  embedText: async (_text: string, kind: "document" | "query") => {
    if (!embedState.ready) return null;
    if (kind === "query") return embedState.queryVec;
    return null;
  },
}));

function unit(i: number, dim = 8): Float32Array {
  const v = new Float32Array(dim);
  v[i % dim] = 1;
  return v;
}

function insertDoc(opts: {
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

  const title = tok(opts.title ?? opts.displayName);
  const body = tok(opts.body ?? "");
  const bodyResult = db
    .prepare(
      `INSERT INTO documents_fts(content, document_id, display_name, relative_path, domain_id, owner_visitor_id, permission)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(body, opts.documentId, opts.displayName, opts.relativePath, opts.domainId, opts.ownerVisitorId, opts.permission);
  db.prepare(`INSERT INTO documents_fts_rowid(document_id, fts_rowid) VALUES(?, ?)`).run(
    opts.documentId,
    bodyResult.lastInsertRowid,
  );
  const titleResult = db
    .prepare(
      `INSERT INTO documents_fts_title(title, document_id, display_name, relative_path, domain_id, owner_visitor_id, permission)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(title, opts.documentId, opts.displayName, opts.relativePath, opts.domainId, opts.ownerVisitorId, opts.permission);
  db.prepare(`INSERT INTO documents_fts_title_rowid(document_id, fts_rowid) VALUES(?, ?)`).run(
    opts.documentId,
    titleResult.lastInsertRowid,
  );
}

function insertChunk(documentId: string, domainId: string, vec: Float32Array, text = "chunk"): void {
  testDbRef.db!
    .prepare(
      `INSERT INTO document_embedding_chunks (document_id, domain_id, chunk_index, text, embedding, updated_at)
       VALUES (?, ?, 0, ?, ?, ?)`,
    )
    .run(documentId, domainId, text, float32ToBlob(vec), new Date().toISOString());
}

describe("embedding-store helpers", () => {
  it("chunks long text with overlap", () => {
    const chunks = chunkPlainText("a".repeat(1200), 500, 50);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]!.length).toBe(500);
  });

  it("roundtrips float32 blob and cosine", () => {
    const a = unit(0);
    const b = unit(0);
    const c = unit(1);
    expect(cosineSimilarity(a, blobToFloat32(float32ToBlob(b)))).toBeCloseTo(1);
    expect(cosineSimilarity(a, c)).toBeCloseTo(0);
  });
});

describe("searchDocuments semantic merge", () => {
  beforeAll(() => {
    testDbRef.db = new Database(":memory:");
    applySchema(testDbRef.db);
  });

  afterEach(() => {
    const db = testDbRef.db!;
    db.exec("DELETE FROM documents");
    db.exec("DELETE FROM documents_fts");
    db.exec("DELETE FROM documents_fts_rowid");
    db.exec("DELETE FROM documents_fts_title");
    db.exec("DELETE FROM documents_fts_title_rowid");
    db.exec("DELETE FROM document_embedding_chunks");
    embedState.ready = true;
    embedState.queryVec = null;
  });

  it("without model readiness, behaves as pure FTS", async () => {
    embedState.ready = false;
    insertDoc({
      documentId: "fts-1",
      domainId: "default",
      displayName: "关键词文档",
      relativePath: "a.md",
      ownerVisitorId: "u1",
      permission: Permission.PUBLIC_READ,
      title: "关键词文档",
      body: "这里有关键词",
    });
    insertChunk("sem-only", "default", unit(0), "语义近邻文本");

    const results = await searchDocuments({
      query: "关键词",
      visitorId: "u1",
      domainId: "default",
    });
    expect(results.map((r) => r.documentId)).toEqual(["fts-1"]);
  });

  it("mode=keyword skips semantic even when model ready", async () => {
    insertDoc({
      documentId: "fts-kw",
      domainId: "default",
      displayName: "关键词文档",
      relativePath: "kw.md",
      ownerVisitorId: "u1",
      permission: Permission.PUBLIC_READ,
      title: "关键词文档",
      body: "这里有关键词",
    });
    insertChunk("sem-blind", "default", unit(2), "语义近邻文本");
    embedState.queryVec = unit(2);

    const results = await searchDocuments({
      query: "关键词",
      visitorId: "u1",
      domainId: "default",
      mode: "keyword",
    });
    expect(results.map((r) => r.documentId)).toEqual(["fts-kw"]);
  });

  it("mode=semantic skips FTS and returns semantic hits only", async () => {
    insertDoc({
      documentId: "sem-only-doc",
      domainId: "default",
      displayName: "密码找回指南",
      relativePath: "pw.md",
      ownerVisitorId: "u1",
      permission: Permission.PUBLIC_READ,
      title: "密码找回指南",
      body: "如何重置登录凭证的步骤说明",
    });
    embedState.queryVec = unit(3);
    insertChunk("sem-only-doc", "default", unit(3), "如何重置登录凭证");

    const results = await searchDocuments({
      query: "完全无关键词重叠的查询",
      visitorId: "u1",
      domainId: "default",
      mode: "semantic",
    });
    expect(results.map((r) => r.documentId)).toEqual(["sem-only-doc"]);
    expect(results[0]!.createdAt).toBeTruthy();
  });

  it("mode=semantic with model not ready returns empty", async () => {
    embedState.ready = false;
    insertDoc({
      documentId: "fts-there",
      domainId: "default",
      displayName: "正常FTS",
      relativePath: "ok.md",
      ownerVisitorId: "u1",
      permission: Permission.PUBLIC_READ,
      title: "正常FTS",
      body: "正常FTS正文",
    });

    const results = await searchDocuments({
      query: "正常FTS",
      visitorId: "u1",
      domainId: "default",
      mode: "semantic",
    });
    expect(results).toEqual([]);
  });

  it("reports hit sources: title/body/semantic", async () => {
    // 标题独命中
    insertDoc({
      documentId: "hit-title",
      domainId: "default",
      displayName: "恢复码说明",
      relativePath: "rc.md",
      ownerVisitorId: "u1",
      permission: Permission.PUBLIC_READ,
      title: "恢复码说明",
      body: "完全无关的正文内容",
    });
    // 标题+正文双命中
    insertDoc({
      documentId: "hit-both",
      domainId: "default",
      displayName: "恢复码入门",
      relativePath: "rc2.md",
      ownerVisitorId: "u1",
      permission: Permission.PUBLIC_READ,
      title: "恢复码入门",
      body: "如何使用恢复码找回身份",
    });
    // 语义独命中
    insertDoc({
      documentId: "hit-sem",
      domainId: "default",
      displayName: "账号找回",
      relativePath: "acc.md",
      ownerVisitorId: "u1",
      permission: Permission.PUBLIC_READ,
      title: "账号找回",
      body: "丢失登录凭证后的处理步骤",
    });
    embedState.queryVec = unit(4);
    insertChunk("hit-sem", "default", unit(4), "丢失登录凭证后的处理步骤");

    const results = await searchDocuments({
      query: "恢复码",
      visitorId: "u1",
      domainId: "default",
    });
    const byId = new Map(results.map((r) => [r.documentId, r]));
    expect(byId.get("hit-title")?.titleHit).toBe(true);
    expect(byId.get("hit-title")?.bodyHit).toBe(false);
    expect(byId.get("hit-both")?.titleHit).toBe(true);
    expect(byId.get("hit-both")?.bodyHit).toBe(true);
    expect(byId.get("hit-sem")?.semanticHit).toBe(true);
    expect(byId.get("hit-sem")?.titleHit).toBe(false);
  });

  it("tokenizeQuery shares jieba tokens with FTS escaping", () => {
    // jieba 把「恢复码使用」切为 恢复/码/使用——与 FTS MATCH 同源
    expect(tokenizeQuery("恢复码 使用")).toEqual(["恢复", "码", "使用"]);
    expect(tokenizeQuery('带"引号"的词')).not.toContain('"');
    expect(tokenizeQuery("   ")).toEqual([]);
  });

  it("semantic-only hit fills FTS blind spot", async () => {
    insertDoc({
      documentId: "sem-doc",
      domainId: "default",
      displayName: "密码找回指南",
      relativePath: "pw.md",
      ownerVisitorId: "u1",
      permission: Permission.PUBLIC_READ,
      title: "密码找回指南",
      body: "如何重置登录凭证的步骤说明",
    });
    const vec = unit(2);
    insertChunk("sem-doc", "default", vec, "如何重置登录凭证");
    embedState.queryVec = unit(2);

    const results = await searchDocuments({
      query: "账户被锁了怎么办", // 与正文无关键词重叠
      visitorId: "u1",
      domainId: "default",
    });

    expect(results.map((r) => r.documentId)).toContain("sem-doc");
    expect(results[0]!.matchSource).toBe("semantic");
  });

  it("embed failure does not break FTS results", async () => {
    insertDoc({
      documentId: "fts-ok",
      domainId: "default",
      displayName: "正常FTS",
      relativePath: "ok.md",
      ownerVisitorId: "u1",
      permission: Permission.PUBLIC_READ,
      title: "正常FTS",
      body: "正常FTS正文",
    });
    embedState.ready = true;
    embedState.queryVec = null; // embedText returns null

    const results = await searchDocuments({
      query: "正常FTS",
      visitorId: "u1",
      domainId: "default",
    });
    expect(results.map((r) => r.documentId)).toEqual(["fts-ok"]);
  });

  it("deleteEmbeddingChunks leaves no rows", () => {
    insertChunk("gone", "default", unit(0));
    deleteEmbeddingChunks(testDbRef.db!, "gone");
    const n = (
      testDbRef.db!.prepare(`SELECT COUNT(*) AS c FROM document_embedding_chunks WHERE document_id = ?`).get(
        "gone",
      ) as { c: number }
    ).c;
    expect(n).toBe(0);
  });
});
