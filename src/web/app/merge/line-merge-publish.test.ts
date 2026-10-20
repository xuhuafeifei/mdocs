import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../services/api-request-error";
import {
  isSameMarkdownBody,
  publishLineMergeDocument,
} from "./line-merge-publish";
import type { DocumentDetail } from "../../../shared/types/document";

function tip(
  partial: Partial<DocumentDetail> & Pick<DocumentDetail, "headCommitId" | "content">,
): DocumentDetail {
  return {
    documentId: "doc-1",
    domainId: "default",
    relativePath: "a.md",
    displayName: "a.md",
    ownerVisitorId: "owner",
    updatedBy: "owner",
    updatedAt: "t",
    createdAt: "t",
    permission: 2,
    fileType: "md",
    parentId: null,
    contentHash: "h",
    ...partial,
  };
}

describe("publishLineMergeDocument", () => {
  it("用当前 tip.head 作 remoteCommitId，merge 204 后再 GET", async () => {
    const getDocument = vi
      .fn()
      .mockResolvedValueOnce(tip({ headCommitId: "head-new", content: '{"full":true}' }))
      .mockResolvedValueOnce(tip({ headCommitId: "merge-1", content: '{"merged":true}' }));
    const updateDocument = vi.fn(async () => undefined);

    const result = await publishLineMergeDocument({
      documentId: "doc-1",
      displayName: "a.md",
      content: '{"merged":true}',
      localBaseCommitId: "base-1",
      localSnapshotContent: '{"local":true}',
      getDocument,
      updateDocument,
    });

    expect(updateDocument).toHaveBeenCalledWith("doc-1", {
      content: '{"merged":true}',
      displayName: "a.md",
      version: {
        localBaseCommitId: "base-1",
        merge: {
          remoteCommitId: "head-new",
          localSnapshotContent: '{"local":true}',
        },
      },
    });
    expect(result.headCommitId).toBe("merge-1");
  });

  it("remoteCommitId 过期 409 时刷新 tip 再试", async () => {
    const getDocument = vi
      .fn()
      .mockResolvedValueOnce(tip({ headCommitId: "head-2", content: "a" }))
      .mockResolvedValueOnce(tip({ headCommitId: "head-3", content: "b" }))
      .mockResolvedValueOnce(tip({ headCommitId: "merge-2", content: "b" }));
    const updateDocument = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiRequestError(409, "VERSION_CONFLICT", "版本冲突，请先合并后再发布"),
      )
      .mockResolvedValueOnce(undefined);

    await publishLineMergeDocument({
      documentId: "doc-1",
      displayName: "a.md",
      content: "body",
      localBaseCommitId: "base-1",
      localSnapshotContent: "local",
      getDocument,
      updateDocument,
    });

    expect(updateDocument.mock.calls[1][1].version.merge.remoteCommitId).toBe("head-3");
  });
});

describe("isSameMarkdownBody", () => {
  it("忽略尾空白与 CRLF", () => {
    expect(isSameMarkdownBody("a\r\n\r\n", "a\n")).toBe(true);
    expect(isSameMarkdownBody("a", "b")).toBe(false);
  });
});
