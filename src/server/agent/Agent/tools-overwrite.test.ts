/**
 * overwrite_document：html 必须 raw 写入（不可 contentFormat=markdown）。
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
import { createDocument, getDocument, updateDocument } from "../../documents/document.service.js";
import { overwriteDocumentTool } from "./tools-overwrite.js";

const OWNER = "owner-1";

async function runOverwrite(params: Record<string, unknown>) {
  const tool = overwriteDocumentTool({ visitorId: OWNER, onEvent: () => {} });
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

describe("overwrite_document tool", () => {
  it("空 html 文档：写入 HTML 原文（不走 markdown 转 Lexical）", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "untitled.html",
      content: "",
      fileType: "html",
      domainId: "public-domain",
      permission: Permission.PUBLIC_READ,
    });
    const html = "<!DOCTYPE html><html><body><h1>示例</h1></body></html>";
    const result = await runOverwrite({
      documentId: created.documentId,
      content: html,
    });
    const details = result.details as {
      status: string;
      overwritten: boolean;
      fileType: string;
    };
    expect(details.status).toBe("overwritten");
    expect(details.overwritten).toBe(true);
    expect(details.fileType).toBe("html");
    expect(fileStoreMocks.lastWriteContent).toBe(html);

    const read = getDocument(created.documentId, OWNER, "text");
    expect(read.content).toBe(html);
  });

  it("html 文档：contentFormat=markdown 仍被服务端拒绝", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "plain.html",
      content: "",
      fileType: "html",
      domainId: "public-domain",
    });
    expect(() =>
      updateDocument({
        actorVisitorId: OWNER,
        documentId: created.documentId,
        content: "# md",
        contentFormat: "markdown",
        version: { localBaseCommitId: created.headCommitId },
      }),
    ).toThrow(/html 文档不支持 contentFormat=markdown/);
  });
});
