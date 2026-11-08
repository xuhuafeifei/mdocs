/**
 * list_document_commits / get_document_commit：读权限 + 正文格式与 get_document 对齐。
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../../db/schema.js";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

const fileStoreMocks = vi.hoisted(() => {
  function mockHash(content: string): string {
    let h = 0;
    for (let i = 0; i < content.length; i++) h = (h * 31 + content.charCodeAt(i)) | 0;
    return `h${(h >>> 0).toString(16)}-${content.length}`;
  }
  return {
    lastWriteContent: "",
    blobs: new Map<string, string>(),
    mockHash,
    reset() {
      fileStoreMocks.lastWriteContent = "";
      fileStoreMocks.blobs.clear();
    },
  };
});

vi.mock("../../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../../storage/file-store.js", () => ({
  writeDocument: (_domainId: string, _relativePath: string, content: string) => {
    fileStoreMocks.lastWriteContent = content;
    const contentHash = fileStoreMocks.mockHash(content);
    return { contentHash, bytes: content.length };
  },
  readDocument: () => ({
    content: fileStoreMocks.lastWriteContent || "",
    contentHash: fileStoreMocks.mockHash(fileStoreMocks.lastWriteContent || ""),
  }),
  writeCommitBlob: (contentHash: string, content: string) => {
    fileStoreMocks.blobs.set(contentHash, content);
    return { blobRef: contentHash, bytes: content.length };
  },
  readCommitBlob: (blobRef: string) => {
    const hit = fileStoreMocks.blobs.get(blobRef);
    if (hit == null) throw new Error("missing blob");
    return hit;
  },
  deleteDocumentFile: () => {},
  renameDocumentFile: () => {},
  sha256: (content: string) => fileStoreMocks.mockHash(content),
}));

import { Permission } from "../../access/access-control.js";
import {
  createDocument,
  updateDocument,
} from "../../documents/document.service.js";
import {
  getDocumentCommitTool,
  getDocumentTool,
  listDocumentCommitsTool,
} from "./tools-documents.js";

const OWNER = "owner-hist-1";
const OUTSIDER = "outsider-hist-1";

async function runTool(
  tool: { execute: Function },
  params: Record<string, unknown>,
) {
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

describe("document history tools", () => {
  it("lists commits and reads historical content with get_document format", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "hist.md",
      content: "# v1",
      contentFormat: "markdown",
      domainId: "public-domain",
      permission: Permission.PUBLIC_READ,
    });
    const listTool = listDocumentCommitsTool({ visitorId: OWNER, onEvent: () => {} });
    const beforeUpdate = await runTool(listTool, { documentId: created.documentId });
    const firstCommitId = (
      beforeUpdate.details as { commits: Array<{ commitId: string }> }
    ).commits[0]?.commitId;
    expect(firstCommitId).toBeTruthy();

    updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: "# v2 更新",
      contentFormat: "markdown",
      message: "second",
    });

    const listed = await runTool(listTool, { documentId: created.documentId });
    const listDetails = listed.details as {
      total: number;
      commits: Array<{ commitId: string; message: string; isHead: boolean }>;
    };
    expect(listDetails.total).toBeGreaterThanOrEqual(2);
    const head = listDetails.commits.find((c) => c.isHead);
    expect(head?.message).toBe("second");
    expect(listDetails.commits.some((c) => c.commitId === firstCommitId)).toBe(true);

    const getTool = getDocumentCommitTool({ visitorId: OWNER, onEvent: () => {} });
    const oldGot = await runTool(getTool, {
      documentId: created.documentId,
      commitId: firstCommitId!,
      format: "md",
    });
    const oldDetails = oldGot.details as { content: string; format: string };
    expect(oldDetails.format).toBe("md");
    expect(oldDetails.content).toContain("# v1");
    expect(oldDetails.content).not.toContain("v2");

    const live = await runTool(getDocumentTool({ visitorId: OWNER, onEvent: () => {} }), {
      documentId: created.documentId,
      format: "md",
    });
    expect((live.details as { content: string }).content).toContain("v2");
  });

  it("outsider cannot list or read commits", async () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "private-hist.md",
      content: "# secret",
      contentFormat: "markdown",
      domainId: OWNER,
      permission: Permission.PRIVATE,
    });
    const listTool = listDocumentCommitsTool({ visitorId: OUTSIDER, onEvent: () => {} });
    await expect(
      runTool(listTool, { documentId: created.documentId }),
    ).rejects.toThrow(/FORBIDDEN|DOC_FORBIDDEN|permission|无权/i);

    const headId = created.headCommitId;
    expect(headId).toBeTruthy();
    const getTool = getDocumentCommitTool({ visitorId: OUTSIDER, onEvent: () => {} });
    await expect(
      runTool(getTool, { documentId: created.documentId, commitId: headId! }),
    ).rejects.toThrow(/FORBIDDEN|DOC_FORBIDDEN|permission|无权/i);
  });
});
