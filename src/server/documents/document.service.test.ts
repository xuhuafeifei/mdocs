/**
 * Permission unit tests for document.service.
 * Covers canReadDocument / canEditDocument across all permission levels and invite states.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../db/schema.js";

/* ── Mock getDb to return an in-memory SQLite DB (needed for invite paths) ── */

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

import { canReadDocument, canEditDocument, Permission } from "./document.service.js";
import { insertDocumentInvite } from "../db/repositories/document.repo.js";
import type { DocumentRow } from "../db/repositories/document.repo.js";

/* ── Test helpers ── */

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

/* ── Lifecycle ── */

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
});

/* ── Tests ── */

describe("canReadDocument", () => {
  describe("permission = PRIVATE (0)", () => {
    it("allows owner to read", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.PRIVATE, owner_visitor_id: OWNER }), OWNER)).toBe(true);
    });

    it("denies null visitor", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.PRIVATE, owner_visitor_id: OWNER }), null)).toBe(false);
    });

    it("denies other visitor", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.PRIVATE, owner_visitor_id: OWNER }), OTHER)).toBe(false);
    });
  });

  describe("permission = PUBLIC_READ (1)", () => {
    it("allows owner to read", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_READ, owner_visitor_id: OWNER }), OWNER)).toBe(true);
    });

    it("allows null visitor to read", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_READ, owner_visitor_id: OWNER }), null)).toBe(true);
    });

    it("allows other visitor to read", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_READ, owner_visitor_id: OWNER }), OTHER)).toBe(true);
    });
  });

  describe("permission = PUBLIC_EDIT (2)", () => {
    it("allows owner to read", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_EDIT, owner_visitor_id: OWNER }), OWNER)).toBe(true);
    });

    it("allows null visitor to read", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_EDIT, owner_visitor_id: OWNER }), null)).toBe(true);
    });

    it("allows other visitor to read", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.PUBLIC_EDIT, owner_visitor_id: OWNER }), OTHER)).toBe(true);
    });
  });

  describe("permission = INVITE (3)", () => {
    it("allows owner to read", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.INVITE, owner_visitor_id: OWNER }), OWNER)).toBe(true);
    });

    it("denies null visitor", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.INVITE, owner_visitor_id: OWNER }), null)).toBe(false);
    });

    it("allows invited visitor to read", () => {
      insertDocumentInvite(testDbRef.db!, "doc-1", OTHER, "read");
      expect(canReadDocument(makeDoc({ permission: Permission.INVITE, owner_visitor_id: OWNER }), OTHER)).toBe(true);
    });

    it("denies visitor without invite", () => {
      expect(canReadDocument(makeDoc({ permission: Permission.INVITE, owner_visitor_id: OWNER }), "no-invite-visitor")).toBe(false);
    });
  });
});

describe("canEditDocument", () => {
  describe("permission = PRIVATE (0)", () => {
    it("allows owner to edit", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.PRIVATE, owner_visitor_id: OWNER }), OWNER)).toBe(true);
    });

    it("denies null visitor", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.PRIVATE, owner_visitor_id: OWNER }), null)).toBe(false);
    });

    it("denies other visitor", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.PRIVATE, owner_visitor_id: OWNER }), OTHER)).toBe(false);
    });
  });

  describe("permission = PUBLIC_READ (1)", () => {
    it("allows owner to edit", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_READ, owner_visitor_id: OWNER }), OWNER)).toBe(true);
    });

    it("denies null visitor", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_READ, owner_visitor_id: OWNER }), null)).toBe(false);
    });

    it("denies other visitor", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_READ, owner_visitor_id: OWNER }), OTHER)).toBe(false);
    });
  });

  describe("permission = PUBLIC_EDIT (2)", () => {
    it("allows owner to edit", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_EDIT, owner_visitor_id: OWNER }), OWNER)).toBe(true);
    });

    it("allows null visitor to edit", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_EDIT, owner_visitor_id: OWNER }), null)).toBe(true);
    });

    it("allows other visitor to edit", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.PUBLIC_EDIT, owner_visitor_id: OWNER }), OTHER)).toBe(true);
    });
  });

  describe("permission = INVITE (3)", () => {
    it("allows owner to edit", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.INVITE, owner_visitor_id: OWNER }), OWNER)).toBe(true);
    });

    it("denies null visitor", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.INVITE, owner_visitor_id: OWNER }), null)).toBe(false);
    });

    it("allows visitor with invite=edit to edit", () => {
      insertDocumentInvite(testDbRef.db!, "doc-1", "invited-editor", "edit");
      expect(canEditDocument(makeDoc({ permission: Permission.INVITE, owner_visitor_id: OWNER }), "invited-editor")).toBe(true);
    });

    it("denies visitor with invite=read to edit", () => {
      insertDocumentInvite(testDbRef.db!, "doc-1", "invited-reader", "read");
      expect(canEditDocument(makeDoc({ permission: Permission.INVITE, owner_visitor_id: OWNER }), "invited-reader")).toBe(false);
    });

    it("denies visitor without invite", () => {
      expect(canEditDocument(makeDoc({ permission: Permission.INVITE, owner_visitor_id: OWNER }), "no-invite-visitor")).toBe(false);
    });
  });
});
