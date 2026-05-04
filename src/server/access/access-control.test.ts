/**
 * 权限模块单元测试（access-control.ts）
 *
 * 覆盖：
 * - validateDomainPermission 所有域类型 × 权限值组合
 * - assertDocumentAccess 全量鉴权（doc not found / delete / read / edit）
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../db/schema.js";

/* ── Mock getDb ── */

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

import {
  Permission,
  validateDomainPermission,
  assertDocumentAccess,
  DocumentError,
} from "./access-control.js";
import { findDomainById } from "../db/repositories/domain.repo.js";
import type { DocumentRow } from "../db/repositories/document.repo.js";

/* ── 生命周期 ── */

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
});

afterEach(() => {
  const db = testDbRef.db!;
  db.exec("DELETE FROM domain_members");
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM domains");
  db.exec("DELETE FROM document_invites");
});

/* ── 辅助函数 ── */

const OWNER = "owner-1";
const OTHER = "other-1";

/** 在数据库中插入一个域 + 文档，返回 domain_id */
function seedDocInDomain(options: {
  domainPermission: string; // "public" | "restricted" | "private"
  docPermission: number;
  ownerId?: string;
  docId?: string;
  domainId?: string;
  memberIds?: string[];
}): string {
  const db = testDbRef.db!;
  const domainId = options.domainId ?? "test-domain";
  const docId = options.docId ?? "test-doc";
  const ownerId = options.ownerId ?? OWNER;
  const now = new Date().toISOString();

  // 创建域
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(domainId, "测试域", ownerId, now, now, options.domainPermission);

  // 创建文档
  db.prepare(
    `INSERT INTO documents
     (document_id, domain_id, relative_path, display_name, owner_visitor_id,
      created_by, updated_by, content_hash, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(docId, domainId, "test.md", "测试文档", ownerId, ownerId, ownerId, "abc", now, now, options.docPermission);

  // 添加域成员
  if (options.memberIds) {
    for (const mid of options.memberIds) {
      db.prepare(
        `INSERT OR IGNORE INTO domain_members (domain_id, visitor_id, joined_at) VALUES (?, ?, ?)`,
      ).run(domainId, mid, now);
    }
  }

  return domainId;
}

// ============================================================
//  validateDomainPermission
// ============================================================

describe("validateDomainPermission", () => {
  describe("public 域", () => {
    it("允许 public_read(3) 和 public_write(4)", () => {
      expect(validateDomainPermission("public", Permission.PUBLIC_READ)).toBe(true);
      expect(validateDomainPermission("public", Permission.PUBLIC_WRITE)).toBe(true);
    });

    it("禁止 private(0) / domain_read(1) / domain_write(2)", () => {
      expect(validateDomainPermission("public", Permission.PRIVATE)).toBe(false);
      expect(validateDomainPermission("public", Permission.DOMAIN_READ)).toBe(false);
      expect(validateDomainPermission("public", Permission.DOMAIN_WRITE)).toBe(false);
    });
  });

  describe("restricted 域", () => {
    it("允许 domain_read(1) 和 domain_write(2)", () => {
      expect(validateDomainPermission("restricted", Permission.DOMAIN_READ)).toBe(true);
      expect(validateDomainPermission("restricted", Permission.DOMAIN_WRITE)).toBe(true);
    });

    it("禁止 private(0) / public_read(3) / public_write(4)", () => {
      expect(validateDomainPermission("restricted", Permission.PRIVATE)).toBe(false);
      expect(validateDomainPermission("restricted", Permission.PUBLIC_READ)).toBe(false);
      expect(validateDomainPermission("restricted", Permission.PUBLIC_WRITE)).toBe(false);
    });
  });

  describe("private 域", () => {
    it("允许全部 0-4 档位", () => {
      expect(validateDomainPermission("private", Permission.PRIVATE)).toBe(true);
      expect(validateDomainPermission("private", Permission.DOMAIN_READ)).toBe(true);
      expect(validateDomainPermission("private", Permission.DOMAIN_WRITE)).toBe(true);
      expect(validateDomainPermission("private", Permission.PUBLIC_READ)).toBe(true);
      expect(validateDomainPermission("private", Permission.PUBLIC_WRITE)).toBe(true);
    });
  });

  it("未知域类型返回 false", () => {
    expect(validateDomainPermission("unknown", Permission.PRIVATE)).toBe(false);
    expect(validateDomainPermission("", Permission.PUBLIC_READ)).toBe(false);
  });
});

// ============================================================
//  assertDocumentAccess
// ============================================================

describe("assertDocumentAccess", () => {
  // ── 文档不存在 ──

  it("文档不存在时抛 404", () => {
    expect(() => assertDocumentAccess("no-such-doc", OWNER, "read")).toThrow(DocumentError);
    try {
      assertDocumentAccess("no-such-doc", OWNER, "read");
    } catch (e) {
      expect((e as DocumentError).status).toBe(404);
    }
  });

  // ── 删除 ──

  it("删除：创建者可删", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(() => assertDocumentAccess("test-doc", OWNER, "delete")).not.toThrow();
  });

  it("删除：非创建者不可删（403）", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(() => assertDocumentAccess("test-doc", OTHER, "delete")).toThrow(DocumentError);
    try {
      assertDocumentAccess("test-doc", OTHER, "delete");
    } catch (e) {
      expect((e as DocumentError).status).toBe(403);
    }
  });

  // ── public 域读 ──

  it("public 域：非创建者可读 public_read(3) 文档", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(() => assertDocumentAccess("test-doc", OTHER, "read")).not.toThrow();
  });

  it("public 域：未登录可读 public_write(4) 文档", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_WRITE });
    expect(() => assertDocumentAccess("test-doc", null, "read")).not.toThrow();
  });

  // ── public 域写 ──

  it("public 域：非创建者可写 public_write(4) 文档", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_WRITE });
    expect(() => assertDocumentAccess("test-doc", OTHER, "edit")).not.toThrow();
  });

  it("public 域：非创建者不可写 public_read(3) 文档（403）", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(() => assertDocumentAccess("test-doc", OTHER, "edit")).toThrow(DocumentError);
    try {
      assertDocumentAccess("test-doc", OTHER, "edit");
    } catch (e) {
      expect((e as DocumentError).status).toBe(403);
    }
  });

  // ── restricted 域读 ──

  it("restricted 域：成员可读 domain_write(2) 文档", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_WRITE, memberIds: [OTHER] });
    expect(() => assertDocumentAccess("test-doc", OTHER, "read")).not.toThrow();
  });

  it("restricted 域：非成员不可读（403）", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_READ });
    expect(() => assertDocumentAccess("test-doc", OTHER, "read")).toThrow(DocumentError);
    try {
      assertDocumentAccess("test-doc", OTHER, "read");
    } catch (e) {
      expect((e as DocumentError).status).toBe(403);
    }
  });

  // ── restricted 域写 ──

  it("restricted 域：成员可写 domain_write(2) 文档", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_WRITE, memberIds: [OTHER] });
    expect(() => assertDocumentAccess("test-doc", OTHER, "edit")).not.toThrow();
  });

  it("restricted 域：成员不可写 domain_read(1) 文档", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_READ, memberIds: [OTHER] });
    expect(() => assertDocumentAccess("test-doc", OTHER, "edit")).toThrow(DocumentError);
  });

  // ── private 域 ──

  it("private 域：非创建者不可读 private(0) 文档（403）", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PRIVATE });
    expect(() => assertDocumentAccess("test-doc", OTHER, "read")).toThrow(DocumentError);
  });

  it("private 域：非创建者可读 public_write(4) 文档", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PUBLIC_WRITE });
    expect(() => assertDocumentAccess("test-doc", OTHER, "read")).not.toThrow();
  });

  it("private 域：非创建者不可写 public_read(3) 文档（仅 owner 可写）", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PUBLIC_READ });
    expect(() => assertDocumentAccess("test-doc", OTHER, "edit")).toThrow(DocumentError);
  });

  it("private 域：非创建者可写 public_write(4) 文档", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PUBLIC_WRITE });
    expect(() => assertDocumentAccess("test-doc", OTHER, "edit")).not.toThrow();
  });

  // ── 创建者不受限 ──

  it("创建者在任何域类型下都可读写任意权限文档", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_READ });
    expect(() => assertDocumentAccess("test-doc", OWNER, "read")).not.toThrow();
    expect(() => assertDocumentAccess("test-doc", OWNER, "edit")).not.toThrow();
  });
});
