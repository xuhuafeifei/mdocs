import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../../db/schema.js";
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

vi.mock("../../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../../storage/file-store.js", () => ({
  writeDocument: (_d: string, _p: string, content: string) => {
    fileStoreMocks.lastWriteContent = content;
    const hash = createHash("sha256").update(content).digest("hex");
    return { contentHash: hash, bytes: content.length };
  },
  readDocument: () => ({
    content: fileStoreMocks.lastWriteContent || "",
    contentHash: createHash("sha256")
      .update(fileStoreMocks.lastWriteContent || "")
      .digest("hex"),
  }),
  writeCommitBlob: (contentHash: string, content: string) => {
    const blobRef = `${contentHash.slice(0, 2)}/${contentHash.slice(2)}`;
    fileStoreMocks.commitBlobs.set(blobRef, content);
    return { blobRef, bytes: content.length };
  },
  readCommitBlob: (blobRef: string) => {
    const c = fileStoreMocks.commitBlobs.get(blobRef);
    if (!c) throw new Error("commit blob not found");
    return c;
  },
  deleteDocumentFile: () => {},
  renameDocumentFile: () => {},
  sha256: (buf: Buffer) => createHash("sha256").update(buf).digest("hex"),
}));

import { Permission } from "../../access/access-control.js";
import { createDocument, getDocument } from "../../documents/document.service.js";
import {
  appendDocumentTool,
  replaceDocumentMarkdownTool,
} from "./tools-document-edit.js";
import { FILE_TYPE } from "../../../shared/file-types.js";

const OWNER = "owner-edit-1";

async function runTool(
  tool: { execute: Function },
  params: Record<string, unknown>,
) {
  return tool.execute("call-1", params, undefined, undefined);
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
  db.exec("DELETE FROM audit_logs");
  fileStoreMocks.reset();
});

describe("append_document / replace_document_markdown", () => {
  it("appends markdown and returns DOCUMENT_CHANGED notice", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "diary.md",
      content: "day1",
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
      contentFormat: "markdown",
    });
    const deps = { visitorId: OWNER, onEvent: () => {} };
    const result = (await runTool(appendDocumentTool(deps), {
      documentId: created.documentId,
      content: "day2",
      message: "追加 day2",
    })).details as {
      status: string;
      notice: string;
      headCommitId: string;
    };
    expect(result.status).toBe("appended");
    expect(result.notice).toContain("DOCUMENT_CHANGED");
    expect(result.notice).toContain(created.documentId);
    expect(result.headCommitId).not.toBe(created.headCommitId);

    const text = getDocument(created.documentId, OWNER, "text").content;
    expect(text).toContain("day1");
    expect(text).toContain("day2");
  });

  it("replace unique fragment preserves surrounding markdown", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "note.md",
      content: "# Title\n\nhello **world** end\n",
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
      contentFormat: "markdown",
    });
    const deps = { visitorId: OWNER, onEvent: () => {} };
    const result = (await runTool(replaceDocumentMarkdownTool(deps), {
      documentId: created.documentId,
      find: "**world**",
      replace: "**mdocs**",
      message: "world→mdocs",
    })).details as { status: string; notice: string };
    expect(result.status).toBe("replaced");
    expect(result.notice).toContain("DOCUMENT_CHANGED");
    const md = getDocument(created.documentId, OWNER, "md").content;
    expect(md).toContain("# Title");
    expect(md).toContain("**mdocs**");
    expect(md).not.toContain("**world**");
  });

  it("replace refuses emptying a non-empty document", async () => {
    const body =
      "一段足够长的正文用来触发破坏性替换保护，后面再跟一些句子保证超过八十个字符。\n\n结尾段。\n";
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "wipe.md",
      content: body,
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
      contentFormat: "markdown",
    });
    const deps = { visitorId: OWNER, onEvent: () => {} };
    await expect(
      runTool(replaceDocumentMarkdownTool(deps), {
        documentId: created.documentId,
        find: body.trim(),
        replace: "",
        message: "误清空",
      }),
    ).rejects.toThrow(/REPLACE_EMPTY_RESULT|REPLACE_TOO_DESTRUCTIVE/);
  });

  it("replace fails when ambiguous without occurrence", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "dup.md",
      content: "aa aa",
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
      contentFormat: "markdown",
    });
    const deps = { visitorId: OWNER, onEvent: () => {} };
    await expect(
      runTool(replaceDocumentMarkdownTool(deps), {
        documentId: created.documentId,
        find: "aa",
        replace: "b",
        message: "noop",
      }),
    ).rejects.toThrow(/FIND_AMBIGUOUS/);
  });

  it("rejects non-md", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "page.html",
      content: "<p>x</p>",
      fileType: FILE_TYPE.HTML,
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
    });
    const deps = { visitorId: OWNER, onEvent: () => {} };
    await expect(
      runTool(appendDocumentTool(deps), {
        documentId: created.documentId,
        content: "y",
        message: "x",
      }),
    ).rejects.toThrow(/NOT_MARKDOWN/);
  });
});
