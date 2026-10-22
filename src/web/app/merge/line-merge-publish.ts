/**
 * md/html 行级 merge 发布：刷新 tip 作为 remoteCommitId（须等于当前 head），
 * merge PUT 为 204 时再 GET；409 时整段重试一次。
 */
import type { DocumentDetail } from "../../../shared/types/document";
import { ApiRequestError } from "../../services/api-request-error";

export type LineMergePublishDeps = {
  documentId: string;
  displayName: string;
  /** 最终正文（Lexical JSON 或 raw html/text） */
  content: string;
  localBaseCommitId: string;
  localSnapshotContent: string;
  getDocument: (documentId: string) => Promise<DocumentDetail>;
  updateDocument: (
    documentId: string,
    input: {
      content: string;
      displayName?: string;
      message?: string;
      source?: "auto" | "manual" | "agent" | "cli";
      version?: {
        localBaseCommitId?: string;
        merge?: {
          remoteCommitId: string;
          localSnapshotContent?: string;
        };
      };
    },
  ) => Promise<DocumentDetail | void>;
};

export async function publishLineMergeDocument(
  params: LineMergePublishDeps,
): Promise<DocumentDetail> {
  const run = async (): Promise<DocumentDetail> => {
    const tip = await params.getDocument(params.documentId);
    if (!tip.headCommitId) {
      throw new Error("missing headCommitId");
    }

    if (params.localBaseCommitId === tip.headCommitId) {
      const linear = await params.updateDocument(params.documentId, {
        content: params.content,
        displayName: params.displayName,
        version: { localBaseCommitId: tip.headCommitId },
      });
      return linear ?? (await params.getDocument(params.documentId));
    }

    await params.updateDocument(params.documentId, {
      content: params.content,
      displayName: params.displayName,
      version: {
        localBaseCommitId: params.localBaseCommitId,
        merge: {
          remoteCommitId: tip.headCommitId,
          localSnapshotContent: params.localSnapshotContent,
        },
      },
    });
    return params.getDocument(params.documentId);
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

/** 决议正文是否等于合并页里的「别人的」侧（全盘接收远端时可直写 tip Lexical） */
export function isSameMarkdownBody(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\r\n/g, "\n").replace(/\s+$/g, "");
  return norm(a) === norm(b);
}
