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
      relativePath: "public-doc.md",
      content: "# hello",
      domainId: "public-domain",
      permission: Permission.PUBLIC_READ,
    });
    expect(doc.permission).toBe(Permission.PUBLIC_READ);
  });

  it("public 域：允许创建 public_write(4) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      relativePath: "public-write-doc.md",
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
        relativePath: "invalid.md",
        content: "# hello",
        domainId: "public-domain",
        permission: Permission.DOMAIN_READ,
      }),
    ).toThrow(DocumentError);
    try {
      createDocument({
        actorVisitorId: OWNER,
        relativePath: "invalid.md",
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
        relativePath: "invalid2.md",
        content: "# hello",
        domainId: "public-domain",
        permission: Permission.PRIVATE,
      }),
    ).toThrow(DocumentError);
  });

  it("restricted 域：允许创建 domain_read(1) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      relativePath: "restricted-doc.md",
      content: "# hello",
      domainId: "restricted-domain",
      permission: Permission.DOMAIN_READ,
    });
    expect(doc.permission).toBe(Permission.DOMAIN_READ);
  });

  it("restricted 域：允许创建 domain_write(2) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      relativePath: "restricted-write.md",
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
        relativePath: "invalid3.md",
        content: "# hello",
        domainId: "restricted-domain",
        permission: Permission.PUBLIC_READ,
      }),
    ).toThrow(DocumentError);
  });

  it("private 域：允许创建 private(0) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      relativePath: "private-doc.md",
      content: "# hello",
      domainId: OWNER,
      permission: Permission.PRIVATE,
    });
    expect(doc.permission).toBe(Permission.PRIVATE);
  });

  it("private 域：允许创建 public_write(4) 文档", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      relativePath: "private-public.md",
      content: "# hello",
      domainId: OWNER,
      permission: Permission.PUBLIC_WRITE,
    });
    expect(doc.permission).toBe(Permission.PUBLIC_WRITE);
  });

  it("不传 permission 时使用域默认值：public 域默认 public_read(3)", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      relativePath: "default-public.md",
      content: "# hello",
      domainId: "public-domain",
    });
    expect(doc.permission).toBe(Permission.PUBLIC_READ);
  });

  it("不传 permission 时使用域默认值：restricted 域默认 domain_read(1)", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      relativePath: "default-restricted.md",
      content: "# hello",
      domainId: "restricted-domain",
    });
    expect(doc.permission).toBe(Permission.DOMAIN_READ);
  });

  it("不传 permission 时使用域默认值：private 域默认 private(0)", () => {
    const doc = createDocument({
      actorVisitorId: OWNER,
      relativePath: "default-private.md",
      content: "# hello",
      domainId: OWNER,
    });
    expect(doc.permission).toBe(Permission.PRIVATE);
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
      relativePath: "invite-test.md",
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
      relativePath: "invite-ok.md",
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
      relativePath: "public-invite.md",
      content: "# hello",
      domainId: "public-domain",
      permission: Permission.PUBLIC_READ,
    });

    expect(() =>
      addDocumentInvite(OWNER, doc.documentId, OUTSIDER, "read"),
    ).not.toThrow();
  });
});
