import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { applySchema } from "../db/schema.js";
import { AUTO_PUBLISH_MESSAGE } from "../../shared/publish-meta.js";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../storage/file-store.js", () => {
  const blobs = new Map<string, string>();
  let last = "";
  return {
    writeDocument: (_d: string, _p: string, content: string) => {
      last = content;
      const hash = createHash("sha256").update(content).digest("hex");
      return { contentHash: hash, bytes: content.length };
    },
    readDocument: () => ({
      content: last,
      contentHash: createHash("sha256").update(last).digest("hex"),
    }),
    writeCommitBlob: (contentHash: string, content: string) => {
      const blobRef = `${contentHash.slice(0, 2)}/${contentHash.slice(2)}`;
      blobs.set(blobRef, content);
      return { blobRef, bytes: content.length };
    },
    readCommitBlob: (blobRef: string) => {
      const c = blobs.get(blobRef);
      if (!c) throw new Error("missing blob");
      return c;
    },
    deleteDocumentFile: () => {},
    renameDocumentFile: () => {},
    sha256: (buf: Buffer) => createHash("sha256").update(buf).digest("hex"),
  };
});

import {
  createDocument,
  listDocumentCommits,
  normalizePublishMeta,
  updateDocument,
} from "./document.service.js";
import { Permission } from "../access/access-control.js";
import { roughUnifiedDiff } from "./suggest-commit-message.js";

const OWNER = "pub-meta-owner";

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("d1", "域", OWNER, now, now, "public");
});

afterEach(() => {
  const db = testDbRef.db!;
  db.exec("DELETE FROM commit_parents");
  db.exec("DELETE FROM document_commits");
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM audit_logs");
});

describe("normalizePublishMeta", () => {
  it("auto 强制固定文案", () => {
    expect(normalizePublishMeta({ source: "auto", message: "x" })).toEqual({
      source: "auto",
      message: AUTO_PUBLISH_MESSAGE,
    });
  });

  it("manual 保留空 message", () => {
    expect(normalizePublishMeta({ source: "manual" })).toEqual({
      source: "manual",
      message: "",
    });
  });
});

describe("updateDocument message/source", () => {
  it("source=auto 落库自动发布", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "a.md",
      content: "v1",
      domainId: "d1",
      permission: Permission.PUBLIC_WRITE,
      contentFormat: "markdown",
    });
    updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: "v2",
      contentFormat: "markdown",
      version: { localBaseCommitId: created.headCommitId },
      source: "auto",
      message: "should-be-ignored",
    });
    const commits = listDocumentCommits(created.documentId);
    const head = commits.find((c) => c.isHead)!;
    expect(head.source).toBe("auto");
    expect(head.message).toBe(AUTO_PUBLISH_MESSAGE);
  });

  it("manual message 可见", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "b.md",
      content: "v1",
      domainId: "d1",
      permission: Permission.PUBLIC_WRITE,
      contentFormat: "markdown",
    });
    updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: "v2",
      contentFormat: "markdown",
      version: { localBaseCommitId: created.headCommitId },
      source: "manual",
      message: "修错别字",
    });
    const head = listDocumentCommits(created.documentId).find((c) => c.isHead)!;
    expect(head.source).toBe("manual");
    expect(head.message).toBe("修错别字");
  });
});

describe("roughUnifiedDiff", () => {
  it("marks changed lines", () => {
    const d = roughUnifiedDiff("a\nb\n", "a\nc\n", 1000);
    expect(d).toContain("- b");
    expect(d).toContain("+ c");
  });
});
