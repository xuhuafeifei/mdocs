import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  countAttachmentsByOwner,
  findAttachmentById,
  insertAttachment,
  reassignAttachmentsOwner,
} from "./attachment.repo.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE attachments (
      attachment_id TEXT PRIMARY KEY,
      document_id TEXT,
      relative_path TEXT NOT NULL,
      mime_type TEXT,
      byte_size INTEGER NOT NULL,
      owner_visitor_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

describe("attachment.repo", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("insert 吃整行，find / count / reassign 按蛇形列工作", () => {
    insertAttachment(
      {
        attachment_id: "att-1",
        document_id: "doc-1",
        relative_path: "uuid.png",
        mime_type: "image/png",
        byte_size: 12,
        owner_visitor_id: "v-from",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      db,
    );

    const row = findAttachmentById("att-1", db);
    expect(row).toEqual({
      attachment_id: "att-1",
      document_id: "doc-1",
      relative_path: "uuid.png",
      mime_type: "image/png",
      byte_size: 12,
      owner_visitor_id: "v-from",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(countAttachmentsByOwner("v-from", db)).toBe(1);

    expect(reassignAttachmentsOwner("v-from", "v-to", db)).toBe(1);
    expect(countAttachmentsByOwner("v-from", db)).toBe(0);
    expect(countAttachmentsByOwner("v-to", db)).toBe(1);
    expect(findAttachmentById("att-1", db)?.owner_visitor_id).toBe("v-to");
  });
});
