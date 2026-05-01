import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { listAllDrafts, deleteDraft, type DraftRecord } from "../storage/drafts";

interface DraftListPageProps {
  onPublish: (docId: string) => void;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

type ToastType = "success" | "error";

export function DraftListPage({ onPublish, onClose, onCountChange }: DraftListPageProps) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [publishingAll, setPublishingAll] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listAllDrafts().then((list) => {
      const unpublished = list.filter((d) => !d.published);
      setDrafts(unpublished);
      onCountChange?.(unpublished.length);
    });
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  async function handlePublish(docId: string): Promise<void> {
    setPublishingIds((prev) => new Set(prev).add(docId));
    try {
      await onPublish(docId);
      // onPublish (publishDraftFromList) already deletes the IndexedDB record
      setDrafts((prev) => {
        const next = prev.filter((d) => d.documentId !== docId);
        onCountChange?.(next.length);
        return next;
      });
      showToast(t("published"), "success");
    } catch {
      showToast(t("publishFailed"), "error");
    } finally {
      setPublishingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }

  async function handleDelete(docId: string): Promise<void> {
    setDeleteConfirmId(null);
    await deleteDraft(docId);
    setDrafts((prev) => {
      const next = prev.filter((d) => d.documentId !== docId);
      onCountChange?.(next.length);
      return next;
    });
    showToast(t("draftDeleted"), "success");
  }

  async function handlePublishAll(): Promise<void> {
    setPublishingAll(true);
    let successCount = 0;
    let failCount = 0;
    for (const d of drafts) {
      try {
        await onPublish(d.documentId);
        successCount++;
      } catch {
        failCount++;
      }
    }
    // After all attempts, remove successfully published drafts
    // We re-fetch from IndexedDB since onPublish deletes the draft
    const remaining = await listAllDrafts();
    const unpublished = remaining.filter((r) => !r.published);
    setDrafts(unpublished);
    onCountChange?.(unpublished.length);

    if (failCount === 0) {
      showToast(t("publishAll"), "success");
    } else {
      showToast(`${successCount} published, ${failCount} failed`, "error");
    }
    setPublishingAll(false);
  }

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const unpublished = drafts;

  return (
    <>
      {/* Overlay */}
      <div className="mdocs-drawer-overlay" onClick={onClose} />

      {/* Drawer */}
      <div className="mdocs-drawer" role="dialog" aria-modal="true">
        {/* Header */}
        <header className="mdocs-drawer-header">
          <div className="mdocs-drawer-header-text">
            <h2 className="mdocs-drawer-title">
              {t("unpublishedDrafts")}
              {unpublished.length > 0 && (
                <span className="mdocs-drawer-count-badge">{unpublished.length}</span>
              )}
            </h2>
            <span className="mdocs-drawer-subtitle">{t("draftCount", { count: String(unpublished.length) })}</span>
          </div>
          <button type="button" className="mdocs-drawer-close-btn" onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </header>

        {/* Body */}
        <div className="mdocs-drawer-body">
          {unpublished.length === 0 ? (
            <div className="mdocs-drawer-empty">
              <div className="mdocs-drawer-empty-icon" aria-hidden="true">✓</div>
              <p className="mdocs-drawer-empty-text">{t("draftsEmptyState")}</p>
            </div>
          ) : (
            <div className="mdocs-drawer-items">
              {unpublished.map((d) => (
                <div key={d.documentId} className="mdocs-drawer-item">
                  <div className="mdocs-drawer-item-icon" aria-hidden="true">📄</div>
                  <div className="mdocs-drawer-item-info">
                    <span className="mdocs-drawer-item-name">
                      {d.displayName || t("unknownTitle")}
                    </span>
                    <span className="mdocs-drawer-item-meta">
                      {formatTime(d.updatedAt)} · {t("localSnapshot")}
                    </span>
                  </div>
                  <div className="mdocs-drawer-item-actions">
                    <button
                      type="button"
                      className="mdocs-btn-ghost mdocs-btn-ghost-primary"
                      disabled={publishingIds.has(d.documentId) || publishingAll}
                      onClick={() => void handlePublish(d.documentId)}
                    >
                      {publishingIds.has(d.documentId) ? t("publishing") : t("publish")}
                    </button>
                    <button
                      type="button"
                      className="mdocs-btn-ghost mdocs-btn-ghost-danger"
                      disabled={publishingAll}
                      onClick={() => setDeleteConfirmId(d.documentId)}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mdocs-drawer-footer">
          <button type="button" onClick={onClose}>
            {t("close")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={unpublished.length === 0 || publishingAll}
            onClick={() => void handlePublishAll()}
          >
            {publishingAll ? t("publishing") : `${t("publishAll")} (${unpublished.length})`}
          </button>
        </footer>

        {/* Toast */}
        {toast && (
          <div className={"mdocs-drawer-toast mdocs-drawer-toast--" + toast.type} role="status">
            {toast.message}
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      {deleteConfirmId && (
        <div
          className="mdocs-dialog-backdrop"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setDeleteConfirmId(null);
          }}
        >
          <div className="mdocs-dialog card" role="dialog" aria-modal="true">
            <h1>{t("delete")}</h1>
            <p className="muted">{t("confirmDeleteDraft")}</p>
            <div className="mdocs-dialog-actions">
              <button type="button" onClick={() => setDeleteConfirmId(null)}>
                {t("cancel")}
              </button>
              <button type="button" className="danger" onClick={() => void handleDelete(deleteConfirmId)}>
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
