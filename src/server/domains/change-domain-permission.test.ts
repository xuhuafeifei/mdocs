import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { applySchema } from "../db/schema.js";
import { listDocumentsByVisitor } from "../db/repositories/document.repo.js";
import { changeDomainPermission, DomainPermissionError } from "./change-domain-permission.js";

function seed() {
  const db = new Database(":memory:");
  applySchema(db);
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

describe("changeDomainPermission", () => {
  it("upgrades a domain that already has documents and rejects a downgrade", () => {
    const db = seed();
    expect(changeDomainPermission("owner", "d1", "restricted", db).permission).toBe("restricted");
    expect(() => changeDomainPermission("owner", "d1", "private", db)).toThrow(DomainPermissionError);
  });
});

describe("listDocumentsByVisitor filters", () => {
  it("filters by domain and groups when asked", () => {
    const db = seed();
    const page = listDocumentsByVisitor(db, "owner", { domainId: "d1", groupBy: "domain" });
    expect(page.total).toBe(1);
    expect(page.items[0]?.documentId).toBe("doc-a");
    expect(page.groups?.[0]?.key).toBe("d1");
    const all = listDocumentsByVisitor(db, "owner", {});
    expect(all.total).toBe(2);
    expect(all.groups).toBeUndefined();
  });
});
