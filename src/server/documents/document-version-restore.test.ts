/**
 * 版本历史：list / restore（旧内容新 commit）
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
  renameDocumentFileIfPresent: () => {},
  sha256: (buf: Buffer) => createHash("sha256").update(buf).digest("hex"),
}));

import { Permission } from "../access/access-control.js";
import {
  createDocument,
  getDocument,
  listDocumentCommits,
  restoreDocumentVersion,
  updateDocument,
} from "./document.service.js";
import { listParentCommitIds } from "../db/repositories/commit.repo.js";
import { getDb } from "../db/connection.js";

const OWNER = "owner-ver-1";

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("public-domain", "公开域", OWNER, now, now, "public");
  db.prepare(
    `INSERT INTO visitors (visitor_id, visitor_name, visitor_token_hash, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(OWNER, "Owner", "hash-owner", now, now);
});

afterEach(() => {
  const db = testDbRef.db!;
  db.exec("DELETE FROM commit_parents");
  db.exec("DELETE FROM document_commits");
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM audit_logs");
  fileStoreMocks.reset();
});

describe("document version restore", () => {
  it("lists commits and restores older version as new head", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      domainId: "public-domain",
      fileName: "ver.md",
      displayName: "ver",
      content: '{"root":{"children":[{"type":"paragraph","children":[{"type":"text","text":"v1"}]}]}}',
      permission: Permission.PUBLIC_EDIT,
    });

    const v2Content =
      '{"root":{"children":[{"type":"paragraph","children":[{"type":"text","text":"v2"}]}]}}';
    const updated = updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: v2Content,
      displayName: "ver",
      version: { localBaseCommitId: created.headCommitId },
    });

    const list = listDocumentCommits(created.documentId);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0]!.isHead).toBe(true);
    expect(list[0]!.commitId).toBe(updated.headCommitId);

    const older = list.find((c) => c.commitId === created.headCommitId);
    expect(older).toBeTruthy();

    const restored = restoreDocumentVersion({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      commitId: created.headCommitId!,
    });

    expect(restored.headCommitId).not.toBe(created.headCommitId);
    expect(restored.headCommitId).not.toBe(updated.headCommitId);
    expect(fileStoreMocks.lastWriteContent).toContain("v1");

    const parents = listParentCommitIds(getDb(), restored.headCommitId!);
    expect(parents).toEqual([updated.headCommitId]);

    const again = listDocumentCommits(created.documentId);
    expect(again[0]!.commitId).toBe(restored.headCommitId);
    expect(again[0]!.isHead).toBe(true);

    const got = getDocument(created.documentId, OWNER);
    expect(got.content).toContain("v1");
  });

  it("is idempotent when restoring current head", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      domainId: "public-domain",
      fileName: "idem.md",
      displayName: "idem",
      content: '{"root":{"children":[{"type":"paragraph","children":[]}]}}',
      permission: Permission.PUBLIC_EDIT,
    });
    const before = listDocumentCommits(created.documentId).length;
    const out = restoreDocumentVersion({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      commitId: created.headCommitId!,
    });
    expect(out.headCommitId).toBe(created.headCommitId);
    expect(listDocumentCommits(created.documentId).length).toBe(before);
  });
});
