/**
 * get_editor_draft：requestId 关联等待前端自动回传（非用户审批）。
 */
import { randomUUID } from "node:crypto";

export type EditorDraftOk = {
  status: "ok";
  documentId: string;
  content: string;
  contentFormat: "markdown" | "html" | "plain";
  source: "editor" | "indexeddb";
  localBaseCommitId?: string | null;
  displayName?: string;
};

export type EditorDraftWaitResult =
  | EditorDraftOk
  | { status: "unavailable"; reason: string }
  | { status: "timeout" }
  | { status: "cancelled" };

type PendingEntry = {
  visitorId: string;
  documentId: string;
  resolve: (result: EditorDraftWaitResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingEntry>();

export const DEFAULT_EDITOR_DRAFT_TIMEOUT_MS = 30_000;

export function waitForEditorDraft(params: {
  visitorId: string;
  documentId: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): { requestId: string; promise: Promise<EditorDraftWaitResult> } {
  const requestId = randomUUID();
  const timeoutMs = Math.min(
    Math.max(params.timeoutMs ?? DEFAULT_EDITOR_DRAFT_TIMEOUT_MS, 3_000),
    120_000,
  );

  const promise = new Promise<EditorDraftWaitResult>((resolve) => {
    const finish = (result: EditorDraftWaitResult) => {
      const cur = pending.get(requestId);
      if (!cur) return;
      clearTimeout(cur.timer);
      pending.delete(requestId);
      resolve(result);
    };

    const timer = setTimeout(() => finish({ status: "timeout" }), timeoutMs);
    pending.set(requestId, {
      visitorId: params.visitorId,
      documentId: params.documentId,
      resolve: finish,
      timer,
    });

    const onAbort = () => finish({ status: "cancelled" });
    if (params.signal) {
      if (params.signal.aborted) {
        onAbort();
        return;
      }
      params.signal.addEventListener("abort", onAbort, { once: true });
    }
  });

  return { requestId, promise };
}

export function resolveEditorDraft(
  visitorId: string,
  requestId: string,
  payload: EditorDraftOk | { status: "unavailable"; reason: string },
): EditorDraftWaitResult {
  const entry = pending.get(requestId);
  if (!entry) throw new Error("editor_draft_not_found");
  if (entry.visitorId !== visitorId) throw new Error("editor_draft_forbidden");
  if (payload.status === "ok") {
    if (payload.documentId !== entry.documentId) {
      throw new Error("editor_draft_document_mismatch");
    }
    if (typeof payload.content !== "string") {
      throw new Error("editor_draft_empty");
    }
  }
  entry.resolve(payload);
  return payload;
}

export function cancelVisitorEditorDrafts(visitorId: string): void {
  for (const [id, entry] of pending) {
    if (entry.visitorId === visitorId) {
      entry.resolve({ status: "cancelled" });
      if (pending.has(id)) {
        clearTimeout(entry.timer);
        pending.delete(id);
      }
    }
  }
}
