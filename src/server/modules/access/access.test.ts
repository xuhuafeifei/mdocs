/**
 * access id 门面：canEnterDomain / canRead / canWrite / assert*
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../../infra/db/schema.js";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../../infra/db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

import {
  assertCanEnterDomain,
  assertCanRead,
  assertCanWrite,
  canEnterDomain,
  canRead,
  canWrite,
} from "./access.js";
import { DocumentError, Permission } from "./access-control.js";

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

const OWNER = "owner-1";
const OTHER = "other-1";

function seed(options: {
  domainPermission: string;
  docPermission: number;
  domainId?: string;
  docId?: string;
  memberIds?: string[];
}) {
  const db = testDbRef.db!;
  const domainId = options.domainId ?? "d1";
  const docId = options.docId ?? "doc1";
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(domainId, "域", OWNER, now, now, options.domainPermission);
  db.prepare(
    `INSERT INTO documents
     (document_id, domain_id, relative_path, display_name, owner_visitor_id,
      created_by, updated_by, content_hash, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(docId, domainId, "a.md", "a", OWNER, OWNER, OWNER, "h", now, now, options.docPermission);
  for (const mid of options.memberIds ?? []) {
    db.prepare(
      `INSERT OR IGNORE INTO domain_members (domain_id, visitor_id, joined_at, role) VALUES (?, ?, ?, ?)`,
    ).run(domainId, mid, now, "read");
  }
  return { domainId, docId };
}

describe("canEnterDomain", () => {
  it("public 域任何人可进", () => {
    seed({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(canEnterDomain(null, "d1")).toBe(true);
    expect(canEnterDomain(OTHER, "d1")).toBe(true);
  });

  it("private 域外人不可进", () => {
    seed({ domainPermission: "private", docPermission: Permission.PRIVATE });
    expect(canEnterDomain(OTHER, "d1")).toBe(false);
    expect(canEnterDomain(OWNER, "d1")).toBe(true);
  });
});

describe("canRead / canWrite", () => {
  it("只传 id：public 可读", () => {
    const { domainId, docId } = seed({
      domainPermission: "public",
      docPermission: Permission.PUBLIC_READ,
    });
    expect(canRead(OTHER, domainId, docId)).toBe(true);
    expect(canWrite(OTHER, domainId, docId)).toBe(false);
  });

  it("domainId 与文档不一致 → false", () => {
    seed({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(canRead(OWNER, "other-domain", "doc1")).toBe(false);
  });

  it("assertCanRead 越域 → DOC_NOT_FOUND", () => {
    seed({ domainPermission: "public", docPermission: Permission.PUBLIC_READ });
    expect(() => assertCanRead(OWNER, "other-domain", "doc1")).toThrow(DocumentError);
    try {
      assertCanRead(OWNER, "other-domain", "doc1");
    } catch (e) {
      expect((e as DocumentError).code).toBe("DOC_NOT_FOUND");
    }
  });

  it("assertCanWrite 无权限 → FORBIDDEN", () => {
    const { domainId, docId } = seed({
      domainPermission: "public",
      docPermission: Permission.PUBLIC_READ,
    });
    expect(() => assertCanWrite(OTHER, domainId, docId)).toThrow(DocumentError);
    try {
      assertCanWrite(OTHER, domainId, docId);
    } catch (e) {
      expect((e as DocumentError).code).toBe("FORBIDDEN");
    }
  });

  it("assertCanEnterDomain private 外人 → FORBIDDEN", () => {
    seed({ domainPermission: "private", docPermission: Permission.PRIVATE });
    expect(() => assertCanEnterDomain(OTHER, "d1")).toThrow(DocumentError);
  });
});
