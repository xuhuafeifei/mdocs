/**
 * 知识图谱集成测试。
 *
 * 用内存 SQLite + mock file-store + mock AI，跑完整的 buildGraph 流程。
 * 验证：DFS 遍历、节点生成、概念归纳、contains 关系生成。
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../db/schema.js";
import { randomUUID } from "node:crypto";

/* ── Mock 基础设施 ── */

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../storage/file-store.js", () => ({
  readDocument: () => ({ content: '{"root":{"children":[]}}', contentHash: "mock-hash" }),
  writeDocument: () => ({ contentHash: "mock-hash", bytes: 0 }),
  writeCommitBlob: () => ({ blobRef: "ab/mock", bytes: 0 }),
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

import { buildGraph } from "./graph/index.js";
import type { Graph, GraphDeps } from "./graph/types.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { buildDocumentTree } from "./tree.service.js";

/* ── 测试辅助 ── */

const OWNER = "owner-1";

function createFolder(name: string, parentId: string | null = null): string {
  const db = testDbRef.db!;
  const folderId = randomUUID();
  const now = new Date().toISOString();
  const parentPath = parentId
    ? findDocumentById(db, parentId)!.relative_path
    : "";
  const folderPath = parentPath ? `${parentPath}/${name}` : name;

  db.prepare(
    `INSERT INTO documents (document_id, domain_id, relative_path, display_name, owner_visitor_id,
     created_by, updated_by, content_hash, created_at, updated_at, permission, file_type, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(folderId, "default", folderPath, name, OWNER, OWNER, OWNER, "", now, now, 1, "dir", parentId);

  return folderId;
}

function createDoc(name: string, parentId: string | null = null, title?: string): string {
  const db = testDbRef.db!;
  const docId = randomUUID();
  const now = new Date().toISOString();
  const parentPath = parentId
    ? findDocumentById(db, parentId)!.relative_path
    : "";
  const docPath = parentPath ? `${parentPath}/${name}` : name;

  db.prepare(
    `INSERT INTO documents (document_id, domain_id, relative_path, display_name, owner_visitor_id,
     created_by, updated_by, content_hash, head_commit_id, created_at, updated_at, permission, file_type, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    docId,
    "default",
    docPath,
    title ?? name.replace(/\.md$/, ""),
    OWNER,
    OWNER,
    OWNER,
    "mock-hash",
    "commit-" + docId.slice(0, 8),
    now,
    now,
    1,
    "md",
    parentId,
  );

  return docId;
}

/** 创建 mock 的 GraphDeps（AI 能力都 mock 掉） */
function createMockDeps(): GraphDeps {
  let extractCount = 0;

  // mock 随机数，让 id 后缀固定，方便断言
  vi.spyOn(Math, "random").mockImplementation(() => {
    extractCount++;
    if (extractCount === 1) return 0.1111;
    if (extractCount === 2) return 0.2222;
    if (extractCount === 3) return 0.3333;
    return 0.9999;
  });

  return {
    // —— AI 能力 mock ——

    extractDocNodes: async () => {
      const idx = extractCount; // extractCount 已在 Math.random 里自增了
      return [
        {
          label: `测试知识要点${idx}`,
          description: `第 ${idx} 个要点描述。`,
          confidence: 0.9,
          heading: "第一节",
        },
      ];
    },

    induceConceptNodes: async () => {
      return [
        {
          label: "测试概念",
          description: "这是一个测试用的上层概念。",
          confidence: 0.8,
        },
      ];
    },

    generateContains: async (nodes) => {
      const conceptNode = nodes.find((n) => n.type === "concept");
      const docNodes = nodes.filter((n) => n.type === "doc");
      if (!conceptNode) return [];
      return docNodes.map((doc) => ({
        from: conceptNode.id,
        to: doc.id,
        type: "contains" as const,
        confidence: 0.85,
      }));
    },

    induceConceptRelations: async () => [],

    // —— 文档操作 ——

    readMarkdown: async () => "# 测试文档\n\n这是测试内容。",

    getCurrentCommitId: async (documentId: string) => {
      return "commit-" + documentId.slice(0, 8);
    },

    readArticleCache: async () => null,

    writeArticleCache: async () => {},

    getDocTitle: async (documentId: string) => {
      const doc = findDocumentById(testDbRef.db!, documentId);
      return doc?.display_name || "未命名";
    },

    readDirGraph: async () => null,

    writeDirGraph: async () => {},

    readDomainGraph: async () => null,

    writeDomainGraph: async () => {},
  };
}

/* ── 生命周期 ── */

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;

  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("default", "Default", "system", now, now, "public");
});

/* ── 测试用例 ── */

describe("buildGraph", () => {
  it("单篇文章：返回 doc 节点，edges 为空", async () => {
    const docId = createDoc("test.md");

    const rootNode = {
      type: "document" as const,
      name: "test.md",
      path: "test.md",
      documentId: docId,
      displayName: "测试文档",
      ownerVisitorId: OWNER,
      updatedAt: new Date().toISOString(),
    };

    const deps = createMockDeps();
    const graph = await buildGraph(rootNode, deps, { force: false });

    expect(graph.edges).toHaveLength(0);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes[0]!.type).toBe("doc");
    expect(graph.nodes[0]!.label).toContain("测试知识要点");
  });

  it("目录：汇总子节点 + 归纳 concept + 生成 contains", async () => {
    const folderId = createFolder("test-folder");
    createDoc("doc1.md", folderId, "文档一");
    createDoc("doc2.md", folderId, "文档二");

    const tree = buildDocumentTree("default", OWNER);
    const folderNode = tree.find(
      (n): n is Extract<typeof n, { type: "folder" }> =>
        n.type === "folder" && n.name === "test-folder",
    );
    expect(folderNode).toBeDefined();
    expect(folderNode!.children.length).toBe(2);

    const deps = createMockDeps();
    const graph = await buildGraph(folderNode!, deps, { force: false });

    // 有 doc 节点
    const docNodes = graph.nodes.filter((n) => n.type === "doc");
    expect(docNodes.length).toBe(2);

    // 有 concept 节点
    const conceptNodes = graph.nodes.filter((n) => n.type === "concept");
    expect(conceptNodes.length).toBe(1);
    expect(conceptNodes[0]!.label).toBe("测试概念");

    // 有 contains 边（concept → 每个 doc）
    const containsEdges = graph.edges.filter((e) => e.type === "contains");
    expect(containsEdges.length).toBe(2);
  });

  it("多级目录：自底向上构建，父目录聚合子目录节点", async () => {
    const parentId = createFolder("parent-folder");
    const childId = createFolder("child-folder", parentId);
    createDoc("child-doc.md", childId, "子目录文档");

    const tree = buildDocumentTree("default", OWNER);
    const parentNode = tree.find(
      (n): n is Extract<typeof n, { type: "folder" }> =>
        n.type === "folder" && n.name === "parent-folder",
    );
    expect(parentNode).toBeDefined();

    const deps = createMockDeps();
    const graph = await buildGraph(parentNode!, deps, { force: false });

    // 父目录图谱里包含子目录的 doc 节点 + 自己归纳的 concept
    const docNodes = graph.nodes.filter((n) => n.type === "doc");
    const conceptNodes = graph.nodes.filter((n) => n.type === "concept");
    expect(docNodes.length + conceptNodes.length).toBeGreaterThan(0);
  });
});
