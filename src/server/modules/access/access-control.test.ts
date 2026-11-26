/**
 * 权限模块单元测试（access-control.ts）
 *
 * 覆盖：
 * - validateDomainPermission 所有域类型 × 权限值组合
 * - assertCan*Document 全量鉴权（doc not found / delete / read / edit）
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../../infra/db/schema.js";

/* ── Mock getDb ── */

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../../infra/db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

import { Permission, validateDomainPermission, DocumentError } from "./access-control.js";
import {
  assertCanDeleteDocument,
  assertCanReadDocument,
  assertCanWriteDocument,
} from "./access.js";
import { findDomainById } from "../domains/repo/domain.repo.js";
import type { Documents } from "../documents/repo/document.repo.js";

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
  /** 成员角色，默认 read；写测例传 write */
  memberRole?: "read" | "write";
}): string {
  const db = testDbRef.db!;
  const domainId = options.domainId ?? "test-domain";
  const docId = options.docId ?? "test-doc";
  const ownerId = options.ownerId ?? OWNER;
  const now = new Date().toISOString();
  const memberRole = options.memberRole === "write" ? "write" : "read";

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
        `INSERT OR IGNORE INTO domain_members (domain_id, visitor_id, joined_at, role) VALUES (?, ?, ?, ?)`,
      ).run(domainId, mid, now, memberRole);
    }
  }

  return domainId;
}

/** 插入一条文档邀请 */
function seedInvite(docId: string, visitorId: string, permission: "read" | "edit" = "read") {
  const db = testDbRef.db!;
  db.prepare(
    `INSERT INTO document_invites (document_id, visitor_id, permission) VALUES (?, ?, ?)`,
  ).run(docId, visitorId, permission);
}

// ============================================================
//  invite 权限（新增）
// ============================================================

describe("document invite — read", () => {
  it("private 域：被 invite read 的非创建者可读", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PRIVATE, docId: "invite-doc" });
    seedInvite("invite-doc", OTHER, "read");
    expect(() => assertCanReadDocument(OTHER, "invite-doc")).not.toThrow();
  });

  it("restricted 域：非成员被 invite read 可读", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_READ, docId: "invite-doc2" });
    seedInvite("invite-doc2", OTHER, "read");
    expect(() => assertCanReadDocument(OTHER, "invite-doc2")).not.toThrow();
  });
});

describe("document invite — edit", () => {
  it("private 域：被 invite edit 的非创建者可编辑", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PRIVATE, docId: "edit-doc" });
    seedInvite("edit-doc", OTHER, "edit");
    expect(() => assertCanWriteDocument(OTHER, "edit-doc")).not.toThrow();
  });

  it("private 域：被 invite read 的非创建者不可编辑（403）", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PRIVATE, docId: "edit-doc2" });
    seedInvite("edit-doc2", OTHER, "read");
    expect(() => assertCanWriteDocument(OTHER, "edit-doc2")).toThrow(DocumentError);
  });

  it("restricted 域：被 invite edit 的非成员可编辑", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_READ, docId: "edit-doc3" });
    seedInvite("edit-doc3", OTHER, "edit");
    expect(() => assertCanWriteDocument(OTHER, "edit-doc3")).not.toThrow();
  });

  it("restricted 域：被 invite read 的非成员不可编辑（403）", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_READ, docId: "edit-doc4" });
    seedInvite("edit-doc4", OTHER, "read");
    expect(() => assertCanWriteDocument(OTHER, "edit-doc4")).toThrow(DocumentError);
  });

  it("private 域 + domain_read：被 invite edit 的非创建者可编辑", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.DOMAIN_READ, docId: "edit-doc5" });
    seedInvite("edit-doc5", OTHER, "edit");
    expect(() => assertCanWriteDocument(OTHER, "edit-doc5")).not.toThrow();
  });

  it("private 域 + public_read：被 invite edit 的非创建者可编辑", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PUBLIC_READ, docId: "edit-doc6" });
    seedInvite("edit-doc6", OTHER, "edit");
    expect(() => assertCanWriteDocument(OTHER, "edit-doc6")).not.toThrow();
  });

  it("private 域 + domain_write：write 成员可编辑，无需 invite", () => {
    seedDocInDomain({
      domainPermission: "private",
      docPermission: Permission.DOMAIN_WRITE,
      docId: "edit-doc7",
      memberIds: [OTHER],
      memberRole: "write",
    });
    expect(() => assertCanWriteDocument(OTHER, "edit-doc7")).not.toThrow();
  });

  it("private 域 + domain_write：非域成员被 invite edit 可编辑", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.DOMAIN_WRITE, docId: "edit-doc8" });
    seedInvite("edit-doc8", OTHER, "edit");
    expect(() => assertCanWriteDocument(OTHER, "edit-doc8")).not.toThrow();
  });
});

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
//  assertCan*Document
// ============================================================

describe("assertCan*Document", () => {
  // ── 文档不存在 ──

  it("文档不存在时抛 404", () => {
    expect(() => assertCanReadDocument(OWNER, "no-such-doc")).toThrow(DocumentError);
    try {
      assertCanReadDocument(OWNER, "no-such-doc");
    } catch (e) {
      expect((e as DocumentError).status).toBe(404);
    }
  });

  // ── 删除 ──

  it("删除：创建者可删", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(() => assertCanDeleteDocument(OWNER, "test-doc")).not.toThrow();
  });

  it("删除：非创建者不可删（403）", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(() => assertCanDeleteDocument(OTHER, "test-doc")).toThrow(DocumentError);
    try {
      assertCanDeleteDocument(OTHER, "test-doc");
    } catch (e) {
      expect((e as DocumentError).status).toBe(403);
    }
  });

  // ── public 域读 ──

  it("public 域：非创建者可读 public_read(3) 文档", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(() => assertCanReadDocument(OTHER, "test-doc")).not.toThrow();
  });

  it("public 域：未登录可读 public_write(4) 文档", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_WRITE });
    expect(() => assertCanReadDocument(null, "test-doc")).not.toThrow();
  });

  // ── public 域写 ──

  it("public 域：非创建者可写 public_write(4) 文档", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_WRITE });
    expect(() => assertCanWriteDocument(OTHER, "test-doc")).not.toThrow();
  });

  it("public 域：非创建者不可写 public_read(3) 文档（403）", () => {
    seedDocInDomain({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(() => assertCanWriteDocument(OTHER, "test-doc")).toThrow(DocumentError);
    try {
      assertCanWriteDocument(OTHER, "test-doc");
    } catch (e) {
      expect((e as DocumentError).status).toBe(403);
    }
  });

  // ── restricted 域读 ──

  it("restricted 域：成员可读 domain_write(2) 文档", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_WRITE, memberIds: [OTHER] });
    expect(() => assertCanReadDocument(OTHER, "test-doc")).not.toThrow();
  });

  it("restricted 域：非成员不可读（403）", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_READ });
    expect(() => assertCanReadDocument(OTHER, "test-doc")).toThrow(DocumentError);
    try {
      assertCanReadDocument(OTHER, "test-doc");
    } catch (e) {
      expect((e as DocumentError).status).toBe(403);
    }
  });

  // ── restricted 域写 ──

  it("restricted 域：write 成员可写 domain_write(2) 文档", () => {
    seedDocInDomain({
      domainPermission: "restricted",
      docPermission: Permission.DOMAIN_WRITE,
      memberIds: [OTHER],
      memberRole: "write",
    });
    expect(() => assertCanWriteDocument(OTHER, "test-doc")).not.toThrow();
  });

  it("restricted 域：read 成员不可写 domain_write(2) 文档", () => {
    seedDocInDomain({
      domainPermission: "restricted",
      docPermission: Permission.DOMAIN_WRITE,
      memberIds: [OTHER],
      memberRole: "read",
    });
    expect(() => assertCanWriteDocument(OTHER, "test-doc")).toThrow(DocumentError);
  });

  it("restricted 域：write 成员可写 domain_read(1) 文档", () => {
    seedDocInDomain({
      domainPermission: "restricted",
      docPermission: Permission.DOMAIN_READ,
      memberIds: [OTHER],
      memberRole: "write",
    });
    expect(() => assertCanWriteDocument(OTHER, "test-doc")).not.toThrow();
  });

  it("restricted 域：read 成员不可写 domain_read(1) 文档", () => {
    seedDocInDomain({
      domainPermission: "restricted",
      docPermission: Permission.DOMAIN_READ,
      memberIds: [OTHER],
      memberRole: "read",
    });
    expect(() => assertCanWriteDocument(OTHER, "test-doc")).toThrow(DocumentError);
  });

  // ── private 域 ──

  it("private 域：非创建者不可读 private(0) 文档（403）", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PRIVATE });
    expect(() => assertCanReadDocument(OTHER, "test-doc")).toThrow(DocumentError);
  });

  it("private 域：非成员不可读 public_write(4)（须先能进域）", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PUBLIC_WRITE });
    expect(() => assertCanReadDocument(OTHER, "test-doc")).toThrow(DocumentError);
    try {
      assertCanReadDocument(OTHER, "test-doc");
    } catch (e) {
      expect((e as DocumentError).code).toBe("FORBIDDEN");
    }
  });

  it("private 域：非创建者不可写 public_read(3) 文档（仅 owner 可写）", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PUBLIC_READ });
    expect(() => assertCanWriteDocument(OTHER, "test-doc")).toThrow(DocumentError);
  });

  it("private 域：非成员不可写 public_write(4)（须先能进域）", () => {
    seedDocInDomain({ domainPermission: "private", docPermission: Permission.PUBLIC_WRITE });
    expect(() => assertCanWriteDocument(OTHER, "test-doc")).toThrow(DocumentError);
  });

  // ── 创建者不受限 ──

  it("创建者在任何域类型下都可读写任意权限文档", () => {
    seedDocInDomain({ domainPermission: "restricted", docPermission: Permission.DOMAIN_READ });
    expect(() => assertCanReadDocument(OWNER, "test-doc")).not.toThrow();
    expect(() => assertCanWriteDocument(OWNER, "test-doc")).not.toThrow();
  });
});

describe("assertCanReadDocument graph cache", () => {
  function seedGraphFile(domainPermission: string, domainId = "graph-domain") {
    const db = testDbRef.db!;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(domainId, "图谱域", "system", now, now, domainPermission);
    db.prepare(
      `INSERT INTO documents
       (document_id, domain_id, relative_path, display_name, owner_visitor_id,
        created_by, updated_by, content_hash, created_at, updated_at, permission, file_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `${domainId}.graph-file`,
      domainId,
      "___graph___.json",
      "___graph___.json",
      "system",
      "system",
      "system",
      "abc",
      now,
      now,
      1,
      "graph_file",
    );
  }

  it("公开工作空间：非属主可读域图谱（permission=1 且 owner=system）", () => {
    seedGraphFile("public", "default");
    expect(() => assertCanReadDocument(OTHER, "default.graph-file")).not.toThrow();
  });

  it("公开工作空间：域图谱仍不可通过文档写权限改", () => {
    seedGraphFile("public", "default");
    expect(() => assertCanWriteDocument(OTHER, "default.graph-file")).toThrow(DocumentError);
  });

  it("私人工作空间：外人不可读图谱缓存", () => {
    seedGraphFile("private", OWNER);
    expect(() => assertCanReadDocument(OTHER, `${OWNER}.graph-file`)).toThrow(DocumentError);
  });

  it("受限工作空间：仅 invite 不可读图谱（不授协作 full）", () => {
    seedGraphFile("restricted", "restricted-graph");
    const db = testDbRef.db!;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO documents
       (document_id, domain_id, relative_path, display_name, owner_visitor_id,
        created_by, updated_by, content_hash, created_at, updated_at, permission)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "invited-doc",
      "restricted-graph",
      "invited.md",
      "invited",
      "system",
      "system",
      "system",
      "abc",
      now,
      now,
      1,
    );
    db.prepare(
      `INSERT INTO document_invites (document_id, visitor_id, permission)
       VALUES (?, ?, ?)`,
    ).run("invited-doc", OTHER, "read");
    expect(() => assertCanReadDocument(OTHER, "restricted-graph.graph-file")).toThrow(
      DocumentError,
    );
  });

  it("受限工作空间：成员可读图谱", () => {
    seedGraphFile("restricted", "restricted-graph-member");
    const db = testDbRef.db!;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO domain_members (domain_id, visitor_id, joined_at)
       VALUES (?, ?, ?)`,
    ).run("restricted-graph-member", OTHER, now);
    expect(() =>
      assertCanReadDocument(OTHER, "restricted-graph-member.graph-file"),
    ).not.toThrow();
  });
});
