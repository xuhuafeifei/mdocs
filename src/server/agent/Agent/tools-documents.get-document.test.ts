/**
 * get_document tool：与 HTTP 同一套 assertDocumentAccess，无权不可读正文。
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../../db/schema.js";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

const fileStoreMocks = vi.hoisted(() => ({
  lastWriteContent: "",
  reset() {
    fileStoreMocks.lastWriteContent = "";
  },
}));

vi.mock("../../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../../storage/file-store.js", () => ({
  writeDocument: (_domainId: string, _relativePath: string, content: string) => {
    fileStoreMocks.lastWriteContent = content;
    return { contentHash: "mock-hash", bytes: content.length };
  },
  readDocument: () => ({
    content: fileStoreMocks.lastWriteContent || "",
    contentHash: "mock-hash",
  }),
  writeCommitBlob: () => ({ blobRef: "ab/mock", bytes: 0 }),
  deleteDocumentFile: () => {},
  renameDocumentFile: () => {},
  sha256: () => "mock-hash",
}));

import { Permission } from "../../access/access-control.js";
import { createDocument } from "../../documents/document.service.js";
import { createDocumentTools } from "./tools-documents.js";

const OWNER = "owner-1";
const OUTSIDER = "outsider-1";

async function runGetDocument(visitorId: string, params: Record<string, unknown>) {
  const tool = createDocumentTools(visitorId).find((t) => t.name === "get_document");
  if (!tool) throw new Error("get_document tool missing");
  return tool.execute("call-1", params as never, undefined as never, undefined as never);
}

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
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(OWNER, "个人域", OWNER, now, now, "private");
});

afterEach(() => {
  const db = testDbRef.db!;
  db.exec("DELETE FROM commit_parents");
  db.exec("DELETE FROM document_commits");
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM document_invites");
  db.exec("DELETE FROM audit_logs");
  fileStoreMocks.reset();
});

describe("get_document tool", () => {
  it("owner 可读正文（默认 text）", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "hello.md",
      content: "你好世界",
      contentFormat: "markdown",
      domainId: "public-domain",
      permission: Permission.PUBLIC_READ,
    });
    const result = await runGetDocument(OWNER, { documentId: created.documentId });
    const details = result.details as {
      content: string;
      format: string;
      documentId: string;
      contentTruncated: boolean;
    };
    expect(details.documentId).toBe(created.documentId);
    expect(details.format).toBe("text");
    expect(details.contentTruncated).toBe(false);
    expect(details.content).toContain("你好世界");
  });

  it("无权访客不可读 private 文档", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "secret.md",
      content: "机密",
      contentFormat: "markdown",
      domainId: OWNER,
      permission: Permission.PRIVATE,
    });
    await expect(runGetDocument(OUTSIDER, { documentId: created.documentId })).rejects.toThrow(
      /FORBIDDEN/,
    );
  });

  it("公开可读文档：非创建者可读", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "open.md",
      content: "公开内容",
      contentFormat: "markdown",
      domainId: "public-domain",
      permission: Permission.PUBLIC_READ,
    });
    const result = await runGetDocument(OUTSIDER, { documentId: created.documentId });
    const details = result.details as { content: string };
    expect(details.content).toContain("公开内容");
  });
});
