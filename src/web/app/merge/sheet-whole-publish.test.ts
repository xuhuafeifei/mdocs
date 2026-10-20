import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../services/api-request-error";
import { publishSheetWholeChoice } from "./sheet-whole-publish";
import type { DocumentDetail } from "../../../shared/types/document";

function tip(partial: Partial<DocumentDetail> & Pick<DocumentDetail, "headCommitId" | "content">): DocumentDetail {
  return {
    documentId: "doc-1",
    domainId: "default",
    relativePath: "a.sheet",
    displayName: "a.sheet",
    ownerVisitorId: "owner",
    updatedBy: "owner",
    updatedAt: "t",
    createdAt: "t",
    permission: 2,
    fileType: "sheet",
    parentId: null,
    contentHash: "h",
    ...partial,
  };
}

describe("publishSheetWholeChoice", () => {
  it("用别人的：merge PUT 204 后再 GET 详情", async () => {
    const getDocument = vi
      .fn()
      .mockResolvedValueOnce(tip({ headCommitId: "head-2", content: '{"remote":true}' }))
      .mockResolvedValueOnce(tip({ headCommitId: "merge-1", content: '{"remote":true}' }));
    // 与线上一致：merge 路径返回 204 → undefined
    const updateDocument = vi.fn(async () => undefined);

    const result = await publishSheetWholeChoice({
      documentId: "doc-1",
      displayName: "a.sheet",
      side: "remote",
      localContent: '{"local":true}',
      localBaseCommitId: "base-1",
      getDocument,
      updateDocument,
    });

    expect(updateDocument).toHaveBeenCalledWith("doc-1", {
      content: '{"remote":true}',
      displayName: "a.sheet",
      version: {
        localBaseCommitId: "base-1",
        merge: {
          remoteCommitId: "head-2",
          localSnapshotContent: '{"local":true}',
        },
      },
    });
    expect(getDocument).toHaveBeenCalledTimes(2);
    expect(result.headCommitId).toBe("merge-1");
  });

  it("remoteCommitId 过期 409 时刷新 tip 再试一次", async () => {
    const getDocument = vi
      .fn()
      .mockResolvedValueOnce(tip({ headCommitId: "head-2", content: '{"v":2}' }))
      .mockResolvedValueOnce(tip({ headCommitId: "head-3", content: '{"v":3}' }))
      .mockResolvedValueOnce(tip({ headCommitId: "merge-2", content: '{"v":3}' }));
    const updateDocument = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiRequestError(409, "VERSION_CONFLICT", "版本冲突，请先合并后再发布"),
      )
      .mockResolvedValueOnce(undefined);

    await publishSheetWholeChoice({
      documentId: "doc-1",
      displayName: "a.sheet",
      side: "remote",
      localContent: '{"local":true}',
      localBaseCommitId: "base-1",
      getDocument,
      updateDocument,
    });

    expect(updateDocument).toHaveBeenCalledTimes(2);
    expect(updateDocument.mock.calls[1][1].version.merge.remoteCommitId).toBe("head-3");
    expect(updateDocument.mock.calls[1][1].content).toBe('{"v":3}');
    expect(getDocument).toHaveBeenCalledTimes(3);
  });

  it("已与 tip 对齐时选远端直接返回 tip", async () => {
    const getDocument = vi.fn(async () =>
      tip({ headCommitId: "head-1", content: '{"remote":true}' }),
    );
    const updateDocument = vi.fn();

    const result = await publishSheetWholeChoice({
      documentId: "doc-1",
      displayName: "a.sheet",
      side: "remote",
      localContent: '{"local":true}',
      localBaseCommitId: "head-1",
      getDocument,
      updateDocument,
    });

    expect(updateDocument).not.toHaveBeenCalled();
    expect(result.headCommitId).toBe("head-1");
  });
});
