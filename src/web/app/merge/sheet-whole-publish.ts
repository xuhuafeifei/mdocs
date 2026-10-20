/**
 * Sheet 整表二选一发布：发布前刷新 tip，避免冲突页里的 remoteCommitId 过期再 409。
 */
import type { DocumentDetail } from "../../../shared/types/document";
import { ApiRequestError } from "../../services/api-request-error";

export type SheetWholePublishDeps = {
  documentId: string;
  displayName: string;
  side: "local" | "remote";
  localContent: string;
  localBaseCommitId: string;
  getDocument: (documentId: string) => Promise<DocumentDetail>;
  updateDocument: (
    documentId: string,
    input: {
      content: string;
      displayName?: string;
      version?: {
        localBaseCommitId?: string;
        merge?: {
          remoteCommitId: string;
          localSnapshotContent?: string;
        };
      };
    },
  ) => Promise<DocumentDetail>;
};

export async function publishSheetWholeChoice(
  params: SheetWholePublishDeps,
): Promise<DocumentDetail> {
  const run = async (): Promise<DocumentDetail> => {
    const tip = await params.getDocument(params.documentId);
    if (!tip.headCommitId) {
      throw new Error("missing headCommitId");
    }
    const content = params.side === "local" ? params.localContent : tip.content;
    if (!content.trim()) {
      throw new Error(params.side === "local" ? "empty local" : "empty remote");
    }

    // 已与 tip 对齐：选远端无需再写；选本地走线性发布
    if (params.localBaseCommitId === tip.headCommitId) {
      if (params.side === "remote") return tip;
      return params.updateDocument(params.documentId, {
        content,
        displayName: params.displayName,
        version: { localBaseCommitId: tip.headCommitId },
      });
    }

    return params.updateDocument(params.documentId, {
      content,
      displayName: params.displayName,
      version: {
        localBaseCommitId: params.localBaseCommitId,
        merge: {
          remoteCommitId: tip.headCommitId,
          localSnapshotContent: params.localContent,
        },
      },
    });
  };

  try {
    return await run();
  } catch (err) {
    if (
      err instanceof ApiRequestError &&
      err.status === 409 &&
      err.code === "VERSION_CONFLICT"
    ) {
      return await run();
    }
    throw err;
  }
}
