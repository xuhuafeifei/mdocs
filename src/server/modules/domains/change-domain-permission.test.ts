import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { applySchema } from "../../infra/db/schema.js";
import {
  countDocumentsByOwner,
  listDocumentsByOwner,
} from "../documents/service/document.service.js";
import { changeDomainPermission, DomainPermissionError } from "./change-domain-permission.js";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../../infra/db/connection.js", () => ({
  getDb: () => testDbRef.db!,
}));

function seed() {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
  db.prepare(
    `INSERT INTO visitors (visitor_id, visitor_name, visitor_token_hash, created_at) VALUES (?, ?, ?, ?)`,
  ).run("owner", "Owner", "h", "2026-01-01T00:00:00.000Z");
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("d1", "D", "owner", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", "private");
  db.prepare(
    `INSERT INTO documents (
      document_id, domain_id, relative_path, display_name, owner_visitor_id, created_by, updated_by,
      content_hash, created_at, updated_at, permission
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("doc-a", "d1", "a.md", "A", "owner", "owner", "owner", "h", "2026-01-02T00:00:00.000Z", "2026-01-02T00:00:00.000Z", 0);
  db.prepare(
    `INSERT INTO documents (
      document_id, domain_id, relative_path, display_name, owner_visitor_id, created_by, updated_by,
      content_hash, created_at, updated_at, permission
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("doc-b", "d2", "b.md", "B", "owner", "owner", "owner", "h", "2026-01-03T00:00:00.000Z", "2026-01-03T00:00:00.000Z", 0);
  return db;
}

const emptyFilters = {
  domainId: null as string | null,
  creatorVisitorId: null as string | null,
  fileType: null as string | null,
};

describe("changeDomainPermission", () => {
  it("upgrades a domain that already has documents and rejects a downgrade", () => {
    const db = seed();
    expect(changeDomainPermission("owner", "d1", "restricted", db).permission).toBe("restricted");
    expect(() => changeDomainPermission("owner", "d1", "private", db)).toThrow(DomainPermissionError);
  });
});

describe("listDocumentsByOwner filters", () => {
  it("filters by domain", () => {
    seed();
    const filters = { ...emptyFilters, domainId: "d1" };
    expect(countDocumentsByOwner("owner", filters)).toBe(1);
    const rows = listDocumentsByOwner("owner", filters, { offset: 0, limit: 20 });
    expect(rows[0]?.document_id).toBe("doc-a");
    expect(countDocumentsByOwner("owner", emptyFilters)).toBe(2);
  });

  it("filters by fileType md vs sheet", () => {
    seed();
    testDbRef.db!.prepare(`UPDATE documents SET file_type = 'sheet' WHERE document_id = 'doc-b'`).run();
    const sheets = listDocumentsByOwner(
      "owner",
      { ...emptyFilters, fileType: "sheet" },
      { offset: 0, limit: 20 },
    );
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.document_id).toBe("doc-b");
    expect(sheets[0]?.file_type).toBe("sheet");
    const mds = listDocumentsByOwner(
      "owner",
      { ...emptyFilters, fileType: "md" },
      { offset: 0, limit: 20 },
    );
    expect(mds).toHaveLength(1);
    expect(mds[0]?.document_id).toBe("doc-a");
    expect(mds[0]?.file_type).toBe("md");
  });
});
