/**
 * 删文审计 recovery + 按 audit 恢复
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../db/schema.js";
import { createHash } from "node:crypto";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

const fileStoreMocks = vi.hoisted(() => ({
  lastWriteContent: "",
  commitBlobs: new Map<string, string>(),
  reset() {
    fileStoreMocks.lastWriteContent = "";
    fileStoreMocks.commitBlobs.clear();
  },
}));

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../storage/file-store.js", () => ({
  writeDocument: (_domainId: string, _relativePath: string, content: string) => {
    fileStoreMocks.lastWriteContent = content;
    const hash = createHash("sha256").update(content).digest("hex");
    return { contentHash: hash, bytes: content.length };
  },
  readDocument: () => ({
    content: fileStoreMocks.lastWriteContent || "{}",
    contentHash: createHash("sha256")
      .update(fileStoreMocks.lastWriteContent || "{}")
      .digest("hex"),
  }),
  writeCommitBlob: (contentHash: string, content: string) => {
    const blobRef = `${contentHash.slice(0, 2)}/${contentHash.slice(2)}`;
    fileStoreMocks.commitBlobs.set(blobRef, content);
    return { blobRef, bytes: content.length };
  },
  readCommitBlob: (blobRef: string) => {
    const content = fileStoreMocks.commitBlobs.get(blobRef);
    if (!content) throw new Error("commit blob not found");
    return content;
  },
  deleteDocumentFile: () => {},
  renameDocumentFile: () => {},
  sha256: (buf: Buffer) => createHash("sha256").update(buf).digest("hex"),
}));

import { DocumentError, Permission } from "../access/access-control.js";
import {
  createDocument,
  getDocument,
  listDeletedDocuments,
  removeDocument,
  restoreDocumentFromAudit,
} from "./document.service.js";
import { findDocumentById } from "../db/repositories/document.repo.js";

const OWNER = "owner-recovery-1";
const OTHER = "other-recovery-1";

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("public-domain", "公开域", OWNER, now, now, "public");
});

afterEach(() => {
  const db = testDbRef.db!;
  db.exec("DELETE FROM commit_parents");
  db.exec("DELETE FROM document_commits");
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM audit_logs");
  fileStoreMocks.reset();
});

describe("document delete recovery", () => {
  it("delete writes recovery; restore brings back same id and content", () => {
    const body = "# keep me\n";
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "keep.md",
      content: body,
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
    });
    const docId = created.documentId;
    const head = created.headCommitId!;

    removeDocument({ actorVisitorId: OWNER, documentId: docId });
    expect(findDocumentById(testDbRef.db!, docId)).toBeUndefined();

    const deleted = listDeletedDocuments({ actorVisitorId: OWNER });
    expect(deleted).toHaveLength(1);
    expect(deleted[0]!.documentId).toBe(docId);
    expect(deleted[0]!.restorable).toBe(true);

    const restored = restoreDocumentFromAudit({
      actorVisitorId: OWNER,
      auditId: deleted[0]!.auditId,
    });
    expect(restored.documentId).toBe(docId);
    expect(restored.headCommitId).toBe(head);
    expect(restored.content).toBe(body);

    const got = getDocument(docId, OWNER, "json");
    expect(got.content).toBe(body);
  });

  it("path conflict returns 409", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "clash.md",
      content: "v1",
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
    });
    removeDocument({ actorVisitorId: OWNER, documentId: created.documentId });
    const auditId = listDeletedDocuments({ actorVisitorId: OWNER })[0]!.auditId;

    createDocument({
      actorVisitorId: OWNER,
      fileName: "clash.md",
      content: "taken",
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
    });

    expect(() =>
      restoreDocumentFromAudit({ actorVisitorId: OWNER, auditId }),
    ).toThrow(DocumentError);
    try {
      restoreDocumentFromAudit({ actorVisitorId: OWNER, auditId });
    } catch (err) {
      expect(err).toBeInstanceOf(DocumentError);
      expect((err as DocumentError).code).toBe("PATH_EXISTS");
      expect((err as DocumentError).status).toBe(409);
    }
  });

  it("other visitor cannot restore", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "mine.md",
      content: "secret",
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
    });
    removeDocument({ actorVisitorId: OWNER, documentId: created.documentId });
    const auditId = listDeletedDocuments({ actorVisitorId: OWNER })[0]!.auditId;

    expect(() =>
      restoreDocumentFromAudit({ actorVisitorId: OTHER, auditId }),
    ).toThrow(/仅原创建者/);
  });
});
