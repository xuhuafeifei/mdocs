/**
 * 文档版本轮询：每 10s 查询 sync-status，不拉正文。
 */
import { useEffect, useState } from "react";
import { getDocumentSyncStatusApi } from "../../services/endpoints";
import type { DocumentSyncStatusKind } from "../../../shared/types/document";

const POLL_MS = 10_000;

export function useDocumentVersion(
  documentId: string | null,
  syncedHeadCommitId: string | null | undefined,
) {
  const [remoteHeadCommitId, setRemoteHeadCommitId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<DocumentSyncStatusKind>("up_to_date");

  useEffect(() => {
    if (!documentId) {
      setRemoteHeadCommitId(null);
      setSyncStatus("up_to_date");
      return;
    }

    let cancelled = false;

    const docId = documentId;

    async function poll(): Promise<void> {
      try {
        const res = await getDocumentSyncStatusApi(
          docId,
          syncedHeadCommitId ?? undefined,
        );
        if (cancelled) return;
        setRemoteHeadCommitId(res.headCommitId);
        setSyncStatus(res.status);
      } catch {
        /* 网络错误时保持上次状态 */
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [documentId, syncedHeadCommitId]);

  const syncBehind =
    Boolean(syncedHeadCommitId && remoteHeadCommitId && syncedHeadCommitId !== remoteHeadCommitId) ||
    syncStatus === "behind";

  return { remoteHeadCommitId, syncStatus, syncBehind };
}
