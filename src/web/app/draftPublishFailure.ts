/**
 * 草稿发布失败：统一打标（IndexedDB publishError）+ 文案。
 * 自动发布扫描 listAllDrafts({ skipFailed: true }) 会跳过已打标草稿。
 */
import { ApiRequestError } from "../services/client";
import type { TranslationKey } from "../i18n/types";
import {
  DRAFT_PUBLISH_ERROR,
  markDraftPublishError,
  type DraftRecord,
} from "../storage/drafts";

/** 由 publishDraftFromList 抛出，表示已打标、可停止自动重试。 */
export class DraftPublishAborted extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(code: string, opts?: { cause?: unknown }) {
    super(code);
    this.name = "DraftPublishAborted";
    this.code = code;
    this.cause = opts?.cause;
  }
}

export function publishErrorCodeFrom(err: unknown): string {
  if (err instanceof DraftPublishAborted) return err.code;
  if (err instanceof ApiRequestError) {
    if (err.status === 404) return DRAFT_PUBLISH_ERROR.DOC_NOT_FOUND;
    return err.code || `HTTP_${err.status}`;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message.trim().slice(0, 120);
  }
  return "UNKNOWN";
}

export function formatDraftPublishFailureMessage(
  t: (k: TranslationKey, vars?: Record<string, string>) => string,
  draft: Pick<DraftRecord, "displayName"> | null | undefined,
  code: string,
  err?: unknown,
): string {
  const name = draft?.displayName || t("unknownTitle");
  if (code === DRAFT_PUBLISH_ERROR.SYNC_HEAD_MISSING) {
    return t("draftPublishFailedSyncHead", { name });
  }
  if (code === DRAFT_PUBLISH_ERROR.DOC_NOT_FOUND) {
    return t("draftPublishFailedNotice", { name });
  }
  const reason =
    err instanceof ApiRequestError
      ? err.message
      : err instanceof Error && err.message
        ? err.message
        : code;
  return t("draftPublishFailedGeneric", { name, reason });
}

/**
 * 写入 publishError 并抛出 DraftPublishAborted（阻止自动发布继续重试）。
 */
export async function failDraftPublish(
  docId: string,
  err: unknown,
  draft?: DraftRecord | null,
): Promise<never> {
  const code = publishErrorCodeFrom(err);
  await markDraftPublishError(docId, code);
  if (err instanceof DraftPublishAborted) {
    throw err;
  }
  throw new DraftPublishAborted(code, { cause: err });
}
