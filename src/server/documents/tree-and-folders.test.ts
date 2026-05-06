/**
 * 文档树与文件夹接口测试（tree.service.ts + folders.routes.ts）
 *
 * 覆盖：
 * 1. 按 parent_id 构建文档树
 * 2. 创建目录接口
 * 3. 删除空目录接口
 * 4. 目录描述文件 ___desc___.md 挂载
 * 5. 跨域同名文件不冲突
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../db/schema.js";

/* ── Mock 基础设施 ── */

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

// mock file-store：不写磁盘
vi.mock("../storage/file-store.js", () => ({
  writeDocument: () => ({ contentHash: "mock-hash", bytes: 0 }),
  readDocument: () => ({ content: "", contentHash: "mock-hash" }),
  deleteDocumentFile: () => {},
}));

// mock config：确保 dataDir 存在，让路径解析不报错
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

// mock logger
vi.mock("../logger/logger.js", () => ({
  useLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

import { buildDocumentTree } from "./tree.service.js";
import { createDocument } from "./document.service.js";
import { findDocumentById, countChildrenByParent } from "../db/repositories/document.repo.js";
import { getDb } from "../db/connection.js";
import { buildFoldersRouter } from "../routes/folders.routes.js";
import type { Express } from "express";
import express from "express";

/* ── 测试辅助 ── */

const OWNER = "owner-1";
const OTHER = "other-2";

function createDoc(path: string, content: string = "# test", domainId: string = "default", parentId: string | null = null) {
  return createDocument({
    actorVisitorId: OWNER,
    relativePath: path,
    content,
    domainId,
    parentId,
  });
}

function createFolder(name: string, domainId: string = "default", parentId: string | null = null, description?: string) {
  const db = getDb();
  const { randomUUID } = require("node:crypto");
  const folderId = randomUUID();
  const now = new Date().toISOString();
  const folderPath = parentId
    ? `${(findDocumentById(db, parentId)!.relative_path)}/${name}`
    : name;

  db.prepare(
    `INSERT INTO documents (document_id, domain_id, relative_path, display_name, owner_visitor_id,
     created_by, updated_by, content_hash, created_at, updated_at, permission, file_type, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(folderId, domainId, folderPath, name, OWNER, OWNER, OWNER, '', now, now, 1, 'dir', parentId);

  if (description) {
    const descPath = `${folderPath}/___desc___.md`;
    db.prepare(
      `INSERT INTO documents (document_id, domain_id, relative_path, display_name, owner_visitor_id,
       created_by, updated_by, content_hash, created_at, updated_at, permission, file_type, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), domainId, descPath, description, OWNER, OWNER, OWNER, '', now, now, 1, 'md', folderId);
  }

  return folderId;
}

/* ── 生命周期 ── */

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;

  const now = new Date().toISOString();
  // 创建测试用域（default 域已由 applySchema 创建，用 INSERT OR IGNORE）
  db.prepare(
    `INSERT OR IGNORE INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("default", "Default", "system", now, now, "public");
  db.prepare(
    `INSERT OR IGNORE INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("domain-b", "Domain B", "system", now, now, "public");
});

afterEach(() => {
  const db = testDbRef.db!;
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM document_invites");
  db.exec("DELETE FROM audit_logs");
});

// ============================================================
//  树构建测试
// ============================================================

describe("buildDocumentTree parent_id logic", () => {
  it("空域返回空树", () => {
    const tree = buildDocumentTree("default", OWNER);
    expect(tree).toEqual([]);
  });

  it("单篇文档，无 parent_id → 挂在根级", () => {
    createDoc("a.md");
    const tree = buildDocumentTree("default", OWNER);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      type: "document",
      name: "a.md",
      path: "a.md",
    });
  });

  it("文件夹 + 文档：子文档挂在文件夹下", () => {
    const folderId = createFolder("guide");
    createDoc("guide/getting-started.md", "# start", "default", folderId);
    const tree = buildDocumentTree("default", OWNER);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      type: "folder",
      name: "guide",
    });
    expect((tree[0] as any).children).toHaveLength(1);
    expect((tree[0] as any).children[0]).toMatchObject({
      type: "document",
      name: "getting-started.md",
    });
  });

  it("空文件夹可以存在", () => {
    createFolder("empty-folder");
    const tree = buildDocumentTree("default", OWNER);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      type: "folder",
      name: "empty-folder",
      children: [],
    });
  });

  it("嵌套目录：a/b/c.md 挂在 b 下，b 挂在 a 下", () => {
    const aId = createFolder("a");
    const bId = createFolder("b", "default", aId);
    createDoc("a/b/c.md", "# c", "default", bId);
    const tree = buildDocumentTree("default", OWNER);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ type: "folder", name: "a" });
    const aChildren = (tree[0] as any).children;
    expect(aChildren).toHaveLength(1);
    expect(aChildren[0]).toMatchObject({ type: "folder", name: "b" });
    const bChildren = aChildren[0].children;
    expect(bChildren).toHaveLength(1);
    expect(bChildren[0]).toMatchObject({ type: "document", name: "c.md" });
  });

  it("排序：文件夹在前，同类型按名字典序", () => {
    createFolder("zebra");
    createFolder("alpha");
    createDoc("zoo.md");
    createDoc("apple.md");
    const tree = buildDocumentTree("default", OWNER);
    expect(tree.map(n => n.name)).toEqual(["alpha", "zebra", "apple.md", "zoo.md"]);
  });

  it("___desc___.md 挂载为父文件夹的 descDocumentId", () => {
    const folderId = createFolder("guide", "default", null, "Folder description");
    const tree = buildDocumentTree("default", OWNER);
    expect((tree[0] as any).descDocumentId).toBeTruthy();
    expect((tree[0] as any).folderDisplayName).toBe("Folder description");
  });

  it("父文件夹被权限过滤掉后，子文档挂在根级", () => {
    // 文件夹 owner 是 OTHER，文档 owner 是 OWNER
    // 这里简化测试：子文档的 parent_id 指向一个不存在的文件夹
    createDoc("orphan.md", "# orphan", "default", "non-existent-parent-id");
    const tree = buildDocumentTree("default", OWNER);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      type: "document",
      name: "orphan.md",
    });
  });
});

// ============================================================
//  跨域同名文件测试
// ============================================================

describe("cross-domain path isolation", () => {
  it("不同域可以创建同名文件", () => {
    const docA = createDoc("same.md", "content A", "default");
    const docB = createDoc("same.md", "content B", "domain-b");
    expect(docA.relativePath).toBe("same.md");
    expect(docB.relativePath).toBe("same.md");
    expect(docA.domainId).toBe("default");
    expect(docB.domainId).toBe("domain-b");
  });

  it("同域内同名文件冲突", () => {
    createDoc("dup.md", "first", "default");
    expect(() => createDoc("dup.md", "second", "default")).toThrow();
  });

  it("树只返回指定域的内容", () => {
    createDoc("a.md", "default content", "default");
    createDoc("b.md", "domain-b content", "domain-b");
    const treeDefault = buildDocumentTree("default", OWNER);
    const treeB = buildDocumentTree("domain-b", OWNER);
    expect(treeDefault.map(n => n.name)).toContain("a.md");
    expect(treeDefault.map(n => n.name)).not.toContain("b.md");
    expect(treeB.map(n => n.name)).toContain("b.md");
    expect(treeB.map(n => n.name)).not.toContain("a.md");
  });
});

// ============================================================
//  文件夹接口测试（通过 Express Router）
// ============================================================

describe("POST /api/folders", () => {
  function makeApp(): Express {
    const app = express();
    app.use(express.json());
    // 模拟已认证访客
    app.use((req, _res, next) => {
      req.visitor = { visitor_id: OWNER, visitor_name: "test", token: "test" } as any;
      next();
    });
    app.use("/api/folders", buildFoldersRouter());
    return app;
  }

  it("创建根级目录", async () => {
    const app = makeApp();
    const res = await (app as any).listen(0);
    const server = app.listen(0);
    const addr = server.address() as any;

    const response = await fetch(`http://127.0.0.1:${addr.port}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "new-folder" }),
    });
    const json = await response.json();

    server.close();
    expect(response.status).toBe(201);
    expect(json.data.folderId).toBeTruthy();
    expect(json.data.path).toBe("new-folder");
  });

  it("创建子目录", async () => {
    const folderId = createFolder("parent");
    const app = makeApp();
    const server = app.listen(0);
    const addr = server.address() as any;

    const response = await fetch(`http://127.0.0.1:${addr.port}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "child", parentId: folderId }),
    });
    const json = await response.json();

    server.close();
    expect(response.status).toBe(201);
    expect(json.data.path).toBe("parent/child");
  });

  it("空 name 返回 400", async () => {
    const app = makeApp();
    const server = app.listen(0);
    const addr = server.address() as any;

    const response = await fetch(`http://127.0.0.1:${addr.port}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    server.close();
    expect(response.status).toBe(400);
  });

  it("同名目录已存在返回 409", async () => {
    createFolder("dup-folder");
    const app = makeApp();
    const server = app.listen(0);
    const addr = server.address() as any;

    const response = await fetch(`http://127.0.0.1:${addr.port}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "dup-folder" }),
    });

    server.close();
    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/folders/:id", () => {
  function makeApp(): Express {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.visitor = { visitor_id: OWNER, visitor_name: "test", token: "test" } as any;
      next();
    });
    app.use("/api/folders", buildFoldersRouter());
    return app;
  }

  it("删除空目录成功", async () => {
    const folderId = createFolder("to-delete");
    const app = makeApp();
    const server = app.listen(0);
    const addr = server.address() as any;

    const response = await fetch(`http://127.0.0.1:${addr.port}/api/folders/${folderId}`, {
      method: "DELETE",
    });

    server.close();
    expect(response.status).toBe(204);
    // 确认数据库里已删除
    const row = findDocumentById(getDb(), folderId);
    expect(row).toBeUndefined();
  });

  it("非空目录返回 409", async () => {
    const folderId = createFolder("not-empty");
    createDoc("not-empty/doc.md", "content", "default", folderId);
    const app = makeApp();
    const server = app.listen(0);
    const addr = server.address() as any;

    const response = await fetch(`http://127.0.0.1:${addr.port}/api/folders/${folderId}`, {
      method: "DELETE",
    });

    server.close();
    expect(response.status).toBe(409);
  });

  it("不存在的目录返回 404", async () => {
    const app = makeApp();
    const server = app.listen(0);
    const addr = server.address() as any;

    const response = await fetch(`http://127.0.0.1:${addr.port}/api/folders/non-existent`, {
      method: "DELETE",
    });

    server.close();
    expect(response.status).toBe(404);
  });
});

// ============================================================
//  countChildrenByParent 测试
// ============================================================

describe("countChildrenByParent", () => {
  it("空文件夹返回 0", () => {
    const folderId = createFolder("empty");
    expect(countChildrenByParent(getDb(), folderId)).toBe(0);
  });

  it("有子文档返回正确数量", () => {
    const folderId = createFolder("with-content");
    createDoc("with-content/a.md", "a", "default", folderId);
    createDoc("with-content/b.md", "b", "default", folderId);
    expect(countChildrenByParent(getDb(), folderId)).toBe(2);
  });

  it("有子文件夹也计数", () => {
    const folderId = createFolder("with-subfolder");
    createFolder("sub", "default", folderId);
    expect(countChildrenByParent(getDb(), folderId)).toBe(1);
  });
});
