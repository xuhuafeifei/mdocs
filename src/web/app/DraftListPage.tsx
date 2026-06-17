/**
 * 未发布草稿列表抽屉页
 * 从 IndexedDB 读取所有未发布的草稿，支持单篇发布、全部发布、删除草稿。
 * 发布成功的草稿会从 IndexedDB 中移除（由 onPublish 回调负责）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { listAllDrafts, deleteDraft, clearDraftPublishError, getDraft, type DraftRecord } from "../storage/drafts";
import { DraftPublishAborted, formatDraftPublishFailureMessage } from "./draftPublishFailure";
import { RecoveryDialog } from "./RecoveryDialog";

interface DraftListPageProps {
  onPublish: (docId: string) => void;
  onClose: () => void;
  onCountChange?: (count: number) => void;
  /** 草稿另存为新文档：成功后父组件负责清除草稿和刷新树 */
  onRecover?: (draft: DraftRecord) => void;
}

type ToastType = "success" | "error";

export function DraftListPage({ onPublish, onClose, onCountChange, onRecover }: DraftListPageProps) {
  const { t } = useI18n();

  // ---- 草稿列表数据 ----
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);

  // ---- 正在发布的文档 ID 集合（用于显示加载状态） ----
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());

  // ---- 是否正在执行「全部发布」 ----
  const [publishingAll, setPublishingAll] = useState(false);

  // ---- 待删除确认的草稿 ID ----
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ---- 正在恢复的草稿（打开 RecoveryDialog） ----
  const [recoveringDraft, setRecoveringDraft] = useState<DraftRecord | null>(null);

  // ---- 临时提示消息 ----
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // ---- Toast 定时器引用 ----
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件挂载状态跟踪，防止卸载后 async setState 导致内存泄漏
  const mountedRef = useRef(true);

  /**
   * 首次加载时从 IndexedDB 读取所有未发布草稿。
   */
  useEffect(() => {
    mountedRef.current = true;
    listAllDrafts().then((list) => {
      if (!mountedRef.current) return;
      // 过滤掉已标记为发布的草稿
      const unpublished = list.filter((d) => !d.published);
      // 更新草稿列表
      setDrafts(unpublished);
      // 通知父组件未发布数量（用于设置页徽标）
      onCountChange?.(unpublished.length);
    });
    return () => {
      mountedRef.current = false;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  /**
   * 按 Escape 键关闭草稿抽屉。
   */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    // 清理函数：移除键盘监听
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /**
   * 展示临时提示（3 秒后自动消失）。
   */
  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    // 清除之前的定时器，防止多个 Toast 时间冲突
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    // 3 秒后自动隐藏 Toast
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /**
   * 发布单篇草稿：调用 onPublish（会删除 IndexedDB 记录），成功后从列表移除。
   */
  async function handlePublish(docId: string): Promise<void> {
    // 重试时先清除失败标记
    await clearDraftPublishError(docId);
    // 将该文档 ID 加入正在发布集合，UI 显示加载状态
    setPublishingIds((prev) => new Set(prev).add(docId));
    try {
      // 调用 App.tsx 传入的发布函数
      await onPublish(docId);
      // onPublish (publishDraftFromList) already deletes the IndexedDB record
      // 从列表中移除已发布的草稿
      setDrafts((prev) => {
        const next = prev.filter((d) => d.documentId !== docId);
        // 通知父组件更新数量
        onCountChange?.(next.length);
        return next;
      });
      // 显示发布成功提示
      showToast(t("published"), "success");
    } catch (err) {
      if (!(err instanceof DraftPublishAborted)) {
        showToast(t("publishFailed"), "error");
      }
      const updated = await getDraft(docId);
      if (updated) {
        setDrafts((prev) => prev.map((d) => (d.documentId === docId ? updated : d)));
      }
    } finally {
      // 无论成功失败，都要从发布集合中移除该 ID
      setPublishingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }

  /**
   * 删除草稿：从 IndexedDB 移除并从列表中过滤掉。
   */
  async function handleDelete(docId: string): Promise<void> {
    // 关闭删除确认弹窗
    setDeleteConfirmId(null);
    // 从 IndexedDB 删除草稿
    await deleteDraft(docId);
    // 从列表中过滤掉已删除的草稿
    setDrafts((prev) => {
      const next = prev.filter((d) => d.documentId !== docId);
      onCountChange?.(next.length);
      return next;
    });
    // 显示删除成功提示
    showToast(t("draftDeleted"), "success");
  }

  /**
   * 另存为新文档：打开 RecoveryDialog。
   */
  function handleRecover(docId: string): void {
    const draft = drafts.find((d) => d.documentId === docId);
    if (draft) setRecoveringDraft(draft);
  }

  /**
   * 恢复成功回调：清除草稿并通知父组件。
   */
  function handleRecoverSuccess(docId: string): void {
    setRecoveringDraft(null);
    // 从 IndexedDB 删除该草稿
    void deleteDraft(docId);
    // 从列表移除
    setDrafts((prev) => {
      const next = prev.filter((d) => d.documentId !== docId);
      onCountChange?.(next.length);
      return next;
    });
    // 通知父组件刷新树
    onRecover?.(drafts.find((d) => d.documentId === docId)!);
    showToast(t("published"), "success");
  }

  /**
   * 批量发布所有草稿：逐篇调用，最后重新拉取 IndexedDB 以刷新列表。
   */
  async function handlePublishAll(): Promise<void> {
    // 标记全部发布中，禁用按钮
    setPublishingAll(true);
    // 统计成功和失败的数量
    let successCount = 0;
    let failCount = 0;
    // 逐篇发布
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

    // 根据结果显示不同的提示
    if (failCount === 0) {
      showToast(t("publishAll"), "success");
    } else {
      showToast(`${successCount} published, ${failCount} failed`, "error");
    }
    // 关闭全部发布中状态
    setPublishingAll(false);
  }

  /**
   * 将时间戳格式化为本地日期时间字符串。
   */
  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const formatPublishError = (draft: DraftRecord): string =>
    formatDraftPublishFailureMessage(t, draft, draft.publishError ?? "UNKNOWN");

  const unpublished = drafts;

  return (
    <>
      {/* 遮罩层：点击关闭抽屉 */}
      <div className="mdocs-drawer-overlay" onClick={onClose} />

      {/* 抽屉主体 */}
      <div className="mdocs-drawer" role="dialog" aria-modal="true">
        {/* 头部 */}
        <header className="mdocs-drawer-header">
          <div className="mdocs-drawer-header-text">
            <h2 className="mdocs-drawer-title">
              {t("unpublishedDrafts")}
              {/* 显示未发布数量徽标 */}
              {unpublished.length > 0 && (
                <span className="mdocs-drawer-count-badge">{unpublished.length}</span>
              )}
            </h2>
            <span className="mdocs-drawer-subtitle">{t("draftCount", { count: String(unpublished.length) })}</span>
          </div>
          {/* 关闭按钮 */}
          <button type="button" className="mdocs-drawer-close-btn" onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </header>

        {/* 内容区 */}
        <div className="mdocs-drawer-body">
          {unpublished.length === 0 ? (
            // 空状态：所有草稿已发布
            <div className="mdocs-drawer-empty">
              <div className="mdocs-drawer-empty-icon" aria-hidden="true">✓</div>
              <p className="mdocs-drawer-empty-text">{t("draftsEmptyState")}</p>
            </div>
          ) : (
            // 草稿列表
            <div className="mdocs-drawer-items">
              {unpublished.map((d) => {
                const isFailed = !!d.publishError;
                return (
                  <div key={d.documentId} className={isFailed ? "mdocs-drawer-item mdocs-drawer-item-failed" : "mdocs-drawer-item"}>
                    <div className="mdocs-drawer-item-icon" aria-hidden="true">📄</div>
                    <div className="mdocs-drawer-item-info">
                      <span className="mdocs-drawer-item-name">
                        {/* 没有显示名称时显示「未命名文档」 */}
                        {d.displayName || t("unknownTitle")}
                      </span>
                      {isFailed ? (
                        <span className="mdocs-drawer-item-error">
                          {formatTime(d.publishErrorAt!)} · {formatPublishError(d)}
                        </span>
                      ) : (
                        <span className="mdocs-drawer-item-meta">
                          {formatTime(d.updatedAt)} · {t("localSnapshot")}
                        </span>
                      )}
                    </div>
                    <div className="mdocs-drawer-item-actions">
                      {isFailed ? (
                        // 失败草稿：显示"另存为新文档"按钮
                        <button
                          type="button"
                          className="mdocs-btn-ghost mdocs-btn-ghost-primary"
                          disabled={publishingAll}
                          onClick={() => handleRecover(d.documentId)}
                        >
                          {t("recoverDraft")}
                        </button>
                      ) : (
                        // 正常草稿：显示"发布"按钮
                        <button
                          type="button"
                          className="mdocs-btn-ghost mdocs-btn-ghost-primary"
                          disabled={publishingIds.has(d.documentId) || publishingAll}
                          onClick={() => void handlePublish(d.documentId)}
                        >
                          {publishingIds.has(d.documentId) ? t("publishing") : t("publish")}
                        </button>
                      )}
                      {/* 删除按钮 */}
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
                );
              })}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <footer className="mdocs-drawer-footer">
          <button type="button" onClick={onClose}>
            {t("close")}
          </button>
          {/* 全部发布按钮 */}
          <button
            type="button"
            className="primary"
            disabled={unpublished.length === 0 || publishingAll}
            onClick={() => void handlePublishAll()}
          >
            {publishingAll ? t("publishing") : `${t("publishAll")} (${unpublished.length})`}
          </button>
        </footer>

        {/* Toast 提示 */}
        {toast && (
          <div className={"mdocs-drawer-toast mdocs-drawer-toast--" + toast.type} role="status">
            {toast.message}
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirmId && (
        <div
          className="mdocs-dialog-backdrop"
          role="presentation"
          // 点击遮罩层关闭确认弹窗
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

      {/* 草稿恢复弹窗 */}
      {recoveringDraft && (
        <RecoveryDialog
          draft={recoveringDraft}
          onClose={() => setRecoveringDraft(null)}
          onSuccess={() => handleRecoverSuccess(recoveringDraft.documentId)}
        />
      )}
    </>
  );
}
