/**
 * 文档版本轮询：每 10s 查询 sync-status，不拉正文。
 */
import { useEffect, useState } from "react";
import { getDocumentSyncStatusApi } from "../../services/endpoints";
import type { DocumentSyncStatusKind } from "../../../shared/types/document";

const POLL_MS = 10_000;

export function useDocumentVersion(
  documentId: string | null,
  /** 用于 sync-status 比较的开编分叉点；无草稿时多为打开文档时的 head */
  syncLocalBaseCommitId: string | null | undefined,
) {
  const [remoteCommitId, setRemoteCommitId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<DocumentSyncStatusKind>("up_to_date");

  useEffect(() => {
    if (!documentId) {
      setRemoteCommitId(null);
      setSyncStatus("up_to_date");
      return;
    }

    let cancelled = false;

    const docId = documentId;

    async function poll(): Promise<void> {
      try {
        const res = await getDocumentSyncStatusApi(
          docId,
          syncLocalBaseCommitId ?? undefined,
        );
        if (cancelled) return;
        setRemoteCommitId(res.headCommitId);
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
  }, [documentId, syncLocalBaseCommitId]);

  const syncBehind =
    Boolean(
      syncLocalBaseCommitId &&
        remoteCommitId &&
        syncLocalBaseCommitId !== remoteCommitId,
    ) || syncStatus === "behind";

  return { remoteCommitId, syncStatus, syncBehind };
}
