/**
 * 文档提交链：冲突检测与 merge 发布
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../db/schema.js";
import { createHash } from "node:crypto";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

const fileStoreMocks = vi.hoisted(() => ({
  lastWriteContent: "",
  reset() {
    fileStoreMocks.lastWriteContent = "";
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
  writeCommitBlob: (contentHash: string, content: string) => ({
    blobRef: `${contentHash.slice(0, 2)}/${contentHash.slice(2)}`,
    bytes: content.length,
  }),
  deleteDocumentFile: () => {},
  sha256: (buf: Buffer) => createHash("sha256").update(buf).digest("hex"),
}));

import { DocumentError } from "../access/access-control.js";
import { createDocument, updateDocument } from "./document.service.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import {
  countParents,
  listParentCommitIds,
} from "../db/repositories/commit.repo.js";

const OWNER = "owner-commit-test";

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO visitors (visitor_id, visitor_name, visitor_token_hash, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(OWNER, "Owner", "hash", now);
});

afterEach(() => {
  const db = testDbRef.db!;
  db.exec("DELETE FROM commit_parents");
  db.exec("DELETE FROM document_commits");
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM audit_logs");
  fileStoreMocks.reset();
});

describe("updateDocument 版本冲突", () => {
  it("base 与 head 一致时成功并推进 head", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "v1.md",
      content: '{"v":1}',
      domainId: "default",
    });
    const base = created.headCommitId!;
    const updated = updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: '{"v":2}',
      version: { baseCommitId: base },
    });
    expect(updated.headCommitId).not.toBe(base);
    const row = findDocumentById(testDbRef.db!, created.documentId);
    expect(row?.head_commit_id).toBe(updated.headCommitId);
  });

  it("base 落后时返回 409 且带远端详情", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "conflict.md",
      content: '{"v":1}',
      domainId: "default",
    });
    const base = created.headCommitId!;
    updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: '{"v":2}',
      version: { baseCommitId: base },
    });
    fileStoreMocks.lastWriteContent = '{"v":2}';

    expect(() =>
      updateDocument({
        actorVisitorId: OWNER,
        documentId: created.documentId,
        content: '{"v":3}',
        version: { baseCommitId: base },
      }),
    ).toThrow(DocumentError);

    try {
      updateDocument({
        actorVisitorId: OWNER,
        documentId: created.documentId,
        content: '{"v":3}',
        version: { baseCommitId: base },
      });
    } catch (e) {
      const err = e as DocumentError;
      expect(err.code).toBe("VERSION_CONFLICT");
      expect(err.status).toBe(409);
      expect(err.details).toMatchObject({
        headCommitId: expect.any(String),
        content: expect.any(String),
      });
    }
  });

  it("未传 version 时不做冲突校验（兼容旧客户端）", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "legacy.md",
      content: "{}",
      domainId: "default",
    });
    expect(() =>
      updateDocument({
        actorVisitorId: OWNER,
        documentId: created.documentId,
        content: '{"noBase":true}',
      }),
    ).not.toThrow();
  });
});

describe("updateDocument merge 发布", () => {
  it("插入 r_local 与双父 merge 节点", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "merge.md",
      content: '{"base":true}',
      domainId: "default",
    });
    const base = created.headCommitId!;

    const remote = updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: '{"remote":true}',
      version: { baseCommitId: base },
    });
    const head = remote.headCommitId!;

    const merged = updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: '{"merged":true}',
      version: {
        baseCommitId: base,
        merge: {
          expectedHeadCommitId: head,
          localSnapshotContent: '{"local":true}',
        },
      },
    });

    expect(merged.headCommitId).not.toBe(head);
    expect(countParents(testDbRef.db!, merged.headCommitId!)).toBe(2);
    const parents = listParentCommitIds(testDbRef.db!, merged.headCommitId!);
    expect(parents).toContain(head);

    const localCommitId = parents.find((p) => p !== head);
    expect(localCommitId).toBeTruthy();
    expect(listParentCommitIds(testDbRef.db!, localCommitId!)).toEqual([base]);
  });

  it("expectedHead 与当前 head 不一致时 409", () => {
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "merge-stale.md",
      content: "{}",
      domainId: "default",
    });
    const base = created.headCommitId!;
    const remote = updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: '{"r":1}',
      version: { baseCommitId: base },
    });
    updateDocument({
      actorVisitorId: OWNER,
      documentId: created.documentId,
      content: '{"r":2}',
      version: { baseCommitId: remote.headCommitId },
    });

    expect(() =>
      updateDocument({
        actorVisitorId: OWNER,
        documentId: created.documentId,
        content: '{"m":1}',
        version: {
          baseCommitId: base,
          merge: { expectedHeadCommitId: remote.headCommitId! },
        },
      }),
    ).toThrow(DocumentError);
  });
});
