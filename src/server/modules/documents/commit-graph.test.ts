import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../../infra/db/schema.js";
import { insertCommit, insertCommitParent } from "./repo/commit.repo.js";
import { isAncestorOf, assertMergeFork, findMergeBaseCommitId } from "./commit-graph.js";
import { DocumentError } from "../access/access-control.js";

describe("commit-graph", () => {
  let db: Database.Database;
  const DOC = "doc-1";
  const now = "2024-01-01T00:00:00.000Z";

  beforeAll(() => {
    db = new Database(":memory:");
    applySchema(db);
    db.prepare(
      `INSERT INTO documents (
        document_id, domain_id, relative_path, display_name, owner_visitor_id,
        created_by, updated_by, content_hash, head_commit_id, created_at, updated_at,
        permission, file_type, parent_id
      ) VALUES (?, 'default', 't.md', 'T', 'v1', 'v1', 'v1', 'h', NULL, ?, ?, 1, 'md', NULL)`,
    ).run(DOC, now, now);

    // a -> c -> d
    const a = "commit-a";
    const c = "commit-c";
    const d = "commit-d";
    for (const [id, hash] of [
      [a, "ha"],
      [c, "hc"],
      [d, "hd"],
    ] as const) {
      insertCommit({
        commit_id: id,
        document_id: DOC,
        content_hash: hash,
        blob_ref: `${hash}/blob`,
        author_visitor_id: "v1",
        created_at: now,
        message: "",
        source: "manual",
      }, db);
    }
    insertCommitParent({ child_commit_id: c, parent_commit_id: a }, db);
    insertCommitParent({ child_commit_id: d, parent_commit_id: c }, db);
    db.prepare(`UPDATE documents SET head_commit_id = ? WHERE document_id = ?`).run(d, DOC);
  });

  it("isAncestorOf：祖先关系", () => {
    expect(isAncestorOf(db, "commit-a", "commit-d")).toBe(true);
    expect(isAncestorOf(db, "commit-c", "commit-d")).toBe(true);
    expect(isAncestorOf(db, "commit-d", "commit-a")).toBe(false);
  });

  it("assertMergeFork：localBase 必须是 remote 的真祖先", () => {
    expect(() => assertMergeFork(db, "commit-a", "commit-d")).not.toThrow();
    expect(() => assertMergeFork(db, "commit-d", "commit-d")).toThrow(DocumentError);
    expect(() => assertMergeFork(db, "commit-d", "commit-a")).toThrow(DocumentError);
  });

  it("findMergeBaseCommitId：线性链与 reset 方向", () => {
    expect(findMergeBaseCommitId(db, "commit-a", "commit-d")).toBe("commit-a");
    expect(findMergeBaseCommitId(db, "commit-d", "commit-a")).toBe("commit-a");
    expect(findMergeBaseCommitId(db, "commit-c", "commit-d")).toBe("commit-c");
  });
});
