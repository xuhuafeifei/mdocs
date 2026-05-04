/**
 * 权限单元测试（access-control.ts）
 *
 * 覆盖五级权限 + invite 叠加 + 域上下文的全场景。
 * canReadDocument / canEditDocument 是纯逻辑函数（invite 查询除外），
 * 测试时通过 getDb mock 走内存 SQLite。
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../db/schema.js";

/* ── Mock getDb 返回内存 SQLite（invite 查询需要） ── */

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

import { canReadDocument, canEditDocument, Permission, type DomainAccessInfo } from "../access/access-control.js";
import { deleteDocumentInvite, insertDocumentInvite } from "../db/repositories/document.repo.js";
import type { DocumentRow } from "../db/repositories/document.repo.js";

/* ── 测试辅助 ── */

const OWNER = "owner-1";
const OTHER = "other-1";

function makeDoc(overrides: Partial<DocumentRow> & { permission: number }): DocumentRow {
  return {
    document_id: "doc-1",
    domain_id: "default",
    relative_path: "test.md",
    display_name: "Test",
    owner_visitor_id: OWNER,
    created_by: OWNER,
    updated_by: OWNER,
    content_hash: "abc",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/** 构造域上下文快捷方式 */
function ctx(domainPermission: string, isDomainMember: boolean): DomainAccessInfo {
  return { domainPermission, isDomainMember };
}

/* ── 生命周期 ── */

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
});

afterEach(() => {
  // 清理邀请记录，避免测试间相互污染
  deleteDocumentInvite(testDbRef.db!, "doc-1", OTHER);
  deleteDocumentInvite(testDbRef.db!, "doc-1", "no-invite-visitor");
  deleteDocumentInvite(testDbRef.db!, "doc-1", "private-invited");
  deleteDocumentInvite(testDbRef.db!, "doc-1", "invited-editor");
  deleteDocumentInvite(testDbRef.db!, "doc-1", "invited-reader");
});

// ============================================================
//  读权限测试
// ============================================================

describe("canReadDocument", () => {
  // ── 创建者 ──

  it("owner 永远可读，无视域类型和权限值", () => {
    expect(canReadDocument(makeDoc({ permission: Permission.PRIVATE, owner_visitor_id: OWNER }), OWNER, ctx("private", false))).toBe(true);
    expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_WRITE, owner_visitor_id: OWNER }), OWNER, ctx("public", false))).toBe(true);
  });

  // ── 未登录 ──

  it("未登录：仅 public_read(3) / public_write(4) 可读", () => {
    expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_READ }), null, ctx("public", false))).toBe(true);
    expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_WRITE }), null, ctx("public", false))).toBe(true);
  });

  it("未登录：domain_read/write 和 private 不可读", () => {
    expect(canReadDocument(makeDoc({ permission: Permission.PRIVATE }), null, ctx("private", false))).toBe(false);
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_READ }), null, ctx("restricted", false))).toBe(false);
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), null, ctx("restricted", false))).toBe(false);
  });

  // ── public 域（仅 3/4 档） ──

  it("public 域：任何人可读 3/4 档文档", () => {
    // public 域没有域成员概念，但即使 isDomainMember=false 也能读
    expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_READ }), OTHER, ctx("public", false))).toBe(true);
    expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_WRITE }), OTHER, ctx("public", false))).toBe(true);
  });

  // ── restricted 域 ──

  it("restricted 域：域成员可读 1/2 档文档", () => {
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_READ }), OTHER, ctx("restricted", true))).toBe(true);
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), OTHER, ctx("restricted", true))).toBe(true);
  });

  it("restricted 域：非成员不可读 1/2 档文档（无 invite）", () => {
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_READ }), OTHER, ctx("restricted", false))).toBe(false);
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), OTHER, ctx("restricted", false))).toBe(false);
  });

  it("restricted 域：非成员有 invite 可读", () => {
    insertDocumentInvite(testDbRef.db!, "doc-1", OTHER, "read");
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_READ }), OTHER, ctx("restricted", false))).toBe(true);
  });

  it("restricted 域：非成员无 invite 不可读", () => {
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), "no-invite-visitor", ctx("restricted", false))).toBe(false);
  });

  // ── private 域 ──

  it("private 域：非创建者不可读 0 档文档（无 invite）", () => {
    expect(canReadDocument(makeDoc({ permission: Permission.PRIVATE }), OTHER, ctx("private", false))).toBe(false);
  });

  it("private 域：非创建者有 invite 可读 0 档文档", () => {
    insertDocumentInvite(testDbRef.db!, "doc-1", "private-invited", "read");
    expect(canReadDocument(makeDoc({ permission: Permission.PRIVATE }), "private-invited", ctx("private", false))).toBe(true);
  });

  it("private 域：非创建者可读 public_read/write 档", () => {
    expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_READ }), OTHER, ctx("private", false))).toBe(true);
    expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_WRITE }), OTHER, ctx("private", false))).toBe(true);
  });

  it("private 域：非创建者不可读 1/2 档（仅有创建者一名域成员）", () => {
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_READ }), OTHER, ctx("private", false))).toBe(false);
    expect(canReadDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), OTHER, ctx("private", false))).toBe(false);
  });
});

// ============================================================
//  写权限测试
// ============================================================

describe("canEditDocument", () => {
  // ── 创建者 ──

  it("owner 永远可写", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.PRIVATE, owner_visitor_id: OWNER }), OWNER, ctx("private", false))).toBe(true);
    expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_READ, owner_visitor_id: OWNER }), OWNER, ctx("public", false))).toBe(true);
  });

  // ── 未登录 ──

  it("未登录：仅 public_write(4) 可写", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_WRITE }), null, ctx("public", false))).toBe(true);
  });

  it("未登录：非 public_write 不可写", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_READ }), null, ctx("public", false))).toBe(false);
    expect(canEditDocument(makeDoc({ permission: Permission.PRIVATE }), null, ctx("private", false))).toBe(false);
  });

  // ── public 域 ──

  it("public 域：任何人可写 public_write(4) 档", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_WRITE }), OTHER, ctx("public", false))).toBe(true);
  });

  it("public 域：不可写 public_read(3) 档（仅 owner 可写）", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_READ }), OTHER, ctx("public", false))).toBe(false);
  });

  // ── restricted 域 ──

  it("restricted 域：域成员可写 domain_write(2) 档", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), OTHER, ctx("restricted", true))).toBe(true);
  });

  it("restricted 域：域成员不可写 domain_read(1) 档", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.DOMAIN_READ }), OTHER, ctx("restricted", true))).toBe(false);
  });

  it("restricted 域：非成员不可写（无 invite）", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), OTHER, ctx("restricted", false))).toBe(false);
  });

  it("restricted 域：非成员有 invite=edit 可写", () => {
    insertDocumentInvite(testDbRef.db!, "doc-1", "invited-editor", "edit");
    expect(canEditDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), "invited-editor", ctx("restricted", false))).toBe(true);
  });

  it("restricted 域：非成员有 invite=read 不可写", () => {
    insertDocumentInvite(testDbRef.db!, "doc-1", "invited-reader", "read");
    expect(canEditDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), "invited-reader", ctx("restricted", false))).toBe(false);
  });

  it("restricted 域：非成员无 invite 不可写", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), "no-invite-visitor", ctx("restricted", false))).toBe(false);
  });

  // ── private 域 ──

  it("private 域：非创建者不可写 0/1/2/3 档", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.PRIVATE }), OTHER, ctx("private", false))).toBe(false);
    expect(canEditDocument(makeDoc({ permission: Permission.DOMAIN_READ }), OTHER, ctx("private", false))).toBe(false);
    expect(canEditDocument(makeDoc({ permission: Permission.DOMAIN_WRITE }), OTHER, ctx("private", false))).toBe(false);
    expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_READ }), OTHER, ctx("private", false))).toBe(false);
  });

  it("private 域：非创建者可写 public_write(4) 档", () => {
    expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_WRITE }), OTHER, ctx("private", false))).toBe(true);
  });
});
