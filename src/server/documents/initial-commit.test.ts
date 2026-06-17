import { describe, it, expect, beforeAll, vi } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { applySchema } from "../db/schema.js";
import { backfillFolderDescHeadCommits } from "./initial-commit.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { findCommitById } from "../db/repositories/commit.repo.js";

vi.mock("../storage/file-store.js", () => ({
  readDocument: () => ({ content: "# Legacy", contentHash: "legacy-hash" }),
  writeCommitBlob: () => ({ blobRef: "ab/legacy", bytes: 8 }),
  writeDocument: () => ({ contentHash: "mock-hash", bytes: 0 }),
}));

describe("backfillFolderDescHeadCommits", () => {
  let db: Database.Database;
  let descId: string;

  beforeAll(() => {
    db = new Database(":memory:");
    applySchema(db);
    const now = new Date().toISOString();
    const folderId = randomUUID();
    descId = randomUUID();
    db.prepare(
      `INSERT INTO documents (document_id, domain_id, relative_path, display_name, owner_visitor_id,
       created_by, updated_by, content_hash, head_commit_id, created_at, updated_at, permission, file_type, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'dir', NULL)`,
    ).run(folderId, "default", "legacy-folder", "Legacy", "owner", "owner", "owner", "", now, now, 1);
    db.prepare(
      `INSERT INTO documents (document_id, domain_id, relative_path, display_name, owner_visitor_id,
       created_by, updated_by, content_hash, head_commit_id, created_at, updated_at, permission, file_type, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'md', ?)`,
    ).run(descId, "default", "legacy-folder/___desc___.md", "Legacy", "owner", "owner", "owner", "", now, now, 1, folderId);

    backfillFolderDescHeadCommits(db);
  });

  it("为无 head 的 ___desc___.md 补 commit", () => {
    const row = findDocumentById(db, descId);
    expect(row?.head_commit_id).toBeTruthy();
    expect(findCommitById(db, row!.head_commit_id!)).toBeTruthy();
  });
});
