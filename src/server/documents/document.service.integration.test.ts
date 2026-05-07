/**
 * 文档服务集成测试（document.service.ts）
 *
 * 覆盖 createDocument 域权限校验、addDocumentInvite 域成员互斥。
 * 使用内存 SQLite + mock file-store，不写磁盘。
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

import { DocumentError, Permission } from "../access/access-control.js";
import { createDocument, addDocumentInvite } from "./document.service.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { findDomainById } from "../db/repositories/domain.repo.js";

/* ── 测试辅助：直接在数据库建文件夹 ── */

function createFolderInDb(domainId: string, name: string, parentId: string | null = null): string {
  const db = testDbRef.db!;
  const folderId = "folder-" + Math.random().toString(36).slice(2, 10);
  const now = new Date().toISOString();
  const path = parentId
    ? `${findDocumentById(db, parentId)!.relative_path}/${name}`
    : name;
  db.prepare(
    `INSERT INTO documents (document_id, domain_id, relative_path, display_name, owner_visitor_id,
     created_by, updated_by, content_hash, created_at, updated_at, permission, file_type, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(folderId, domainId, path, name, OWNER, OWNER, OWNER, '', now, now, 1, 'dir', parentId);
  return folderId;
}

/* ── 生命周期 ── */

const OWNER = "owner-1";
const MEMBER = "member-1";
const OUTSIDER = "outsider-1";

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;

  // 创建测试用域
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("restricted-domain", "受限域", OWNER, now, now, "restricted");
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("public-domain", "公开域", OWNER, now, now, "public");
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(OWNER, "个人域", OWNER, now, now, "private");

  // restricted 域添加一名成员
  db.prepare(
    `INSERT OR IGNORE INTO domain_members (domain_id, visitor_id, joined_at) VALUES (?, ?, ?)`,
  ).run("restricted-domain", MEMBER, now);
});

afterEach(() => {
  const db = testDbRef.db!;
  // 清理测试中文档和邀请（域、成员保留）
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM document_invites");
  db.exec("DELETE FROM audit_logs");
});

// ============================================================
//  createDocument：域权限校验
// ============================================================

describe("createDocument 域权限校验", () => {
  it("public 域：允许创建 public_read(3) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "public-doc.md",
      content: "# hello",
      domainId: "public-domain",
      permission: Permission.PUBLIC_READ,
    });
    expect(doc.permission).toBe(Permission.PUBLIC_READ);
  });

  it("public 域：允许创建 public_write(4) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "public-write-doc.md",
      content: "# hello",
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
    });
    expect(doc.permission).toBe(Permission.PUBLIC_WRITE);
  });

  it("public 域：拒绝创建 domain_read(1) 文档（400）", () => {
    expect(() =>
      createDocument({
        actorVisitorId: OWNER,
        fileName: "invalid.md",
        content: "# hello",
        domainId: "public-domain",
        permission: Permission.DOMAIN_READ,
      }),
    ).toThrow(DocumentError);
    try {
      createDocument({
        actorVisitorId: OWNER,
        fileName: "invalid.md",
        content: "# hello",
        domainId: "public-domain",
        permission: Permission.DOMAIN_READ,
      });
    } catch (e) {
      expect((e as DocumentError).code).toBe("INVALID_PERMISSION");
      expect((e as DocumentError).status).toBe(400);
    }
  });

  it("public 域：拒绝创建 private(0) 文档（400）", () => {
    expect(() =>
      createDocument({
        actorVisitorId: OWNER,
        fileName: "invalid2.md",
        content: "# hello",
        domainId: "public-domain",
        permission: Permission.PRIVATE,
      }),
    ).toThrow(DocumentError);
  });

  it("restricted 域：允许创建 domain_read(1) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "restricted-doc.md",
      content: "# hello",
      domainId: "restricted-domain",
      permission: Permission.DOMAIN_READ,
    });
    expect(doc.permission).toBe(Permission.DOMAIN_READ);
  });

  it("restricted 域：允许创建 domain_write(2) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "restricted-write.md",
      content: "# hello",
      domainId: "restricted-domain",
      permission: Permission.DOMAIN_WRITE,
    });
    expect(doc.permission).toBe(Permission.DOMAIN_WRITE);
  });

  it("restricted 域：拒绝创建 public_read(3) 文档（400）", () => {
    expect(() =>
      createDocument({
        actorVisitorId: OWNER,
        fileName: "invalid3.md",
        content: "# hello",
        domainId: "restricted-domain",
        permission: Permission.PUBLIC_READ,
      }),
    ).toThrow(DocumentError);
  });

  it("private 域：允许创建 private(0) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "private-doc.md",
      content: "# hello",
      domainId: OWNER,
      permission: Permission.PRIVATE,
    });
    expect(doc.permission).toBe(Permission.PRIVATE);
  });

  it("private 域：允许创建 public_write(4) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "private-public.md",
      content: "# hello",
      domainId: OWNER,
      permission: Permission.PUBLIC_WRITE,
    });
    expect(doc.permission).toBe(Permission.PUBLIC_WRITE);
  });

  it("不传 permission 时使用域默认值：public 域默认 public_read(3)", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "default-public.md",
      content: "# hello",
      domainId: "public-domain",
    });
    expect(doc.permission).toBe(Permission.PUBLIC_READ);
  });

  it("不传 permission 时使用域默认值：restricted 域默认 domain_read(1)", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "default-restricted.md",
      content: "# hello",
      domainId: "restricted-domain",
    });
    expect(doc.permission).toBe(Permission.DOMAIN_READ);
  });

  it("不传 permission 时使用域默认值：private 域默认 private(0)", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "default-private.md",
      content: "# hello",
      domainId: OWNER,
    });
    expect(doc.permission).toBe(Permission.PRIVATE);
  });

  it("传入 parentId 后文档挂在对应父目录下", () => {
    const folderId = createFolderInDb("public-domain", "my-folder");
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "child.md",
      content: "# child",
      domainId: "public-domain",
      parentId: folderId,
    });
    // 验证数据库中 parent_id 已设置
    const row = findDocumentById(testDbRef.db!, doc.documentId);
    expect(row?.parent_id).toBe(folderId);
  });
});

// ============================================================
//  addDocumentInvite：域成员互斥
// ============================================================

describe("addDocumentInvite 域成员互斥", () => {
  it("restricted 域：已是域成员则禁止 invite（400）", () => {
    // 在 restricted 域中建一篇文档
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "invite-test.md",
      content: "# hello",
      domainId: "restricted-domain",
      permission: Permission.DOMAIN_READ,
    });

    // MEMBER 是 restricted-domain 的成员，尝试 invite 应该被拒绝
    expect(() =>
      addDocumentInvite(OWNER, doc.documentId, MEMBER, "read"),
    ).toThrow(DocumentError);
    try {
      addDocumentInvite(OWNER, doc.documentId, MEMBER, "read");
    } catch (e) {
      expect((e as DocumentError).status).toBe(400);
      expect((e as DocumentError).code).toBe("BAD_REQUEST");
    }
  });

  it("restricted 域：非域成员可以被 invite", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "invite-ok.md",
      content: "# hello",
      domainId: "restricted-domain",
      permission: Permission.DOMAIN_READ,
    });

    expect(() =>
      addDocumentInvite(OWNER, doc.documentId, OUTSIDER, "read"),
    ).not.toThrow();
  });

  it("public 域：非域成员可以被 invite", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      fileName: "public-invite.md",
      content: "# hello",
      domainId: "public-domain",
      permission: Permission.PUBLIC_READ,
    });

    expect(() =>
      addDocumentInvite(OWNER, doc.documentId, OUTSIDER, "read"),
    ).not.toThrow();
  });
});
