/**
 * 自动发布 Hook（类似 Linux pdflush）
 * 定时扫描 IndexedDB 中的未发布草稿，当草稿闲置超过 30 秒时自动推送到服务器。
 * 注意：实际删除草稿的乐观锁逻辑由调用方（App.tsx 的 publishDraftFromList）负责。
 */
import { useEffect, useRef } from "react";
import { listAllDrafts } from "../../storage/drafts";

export function useAutoPublish(
  enabled: boolean,
  onPublishDraft: (docId: string) => Promise<void>,
) {
  // 用 ref 保存最新的 onPublishDraft，避免闭包陷阱
  const onPublishDraftRef = useRef(onPublishDraft);
  onPublishDraftRef.current = onPublishDraft;

  /**
   * 启动定时扫描：每 10 秒检查一次 IndexedDB，发布闲置超过 30 秒的草稿。
   */
  useEffect(() => {
    // 如果用户未开启自动同步，不启动扫描
    if (!enabled) return;

    // 草稿闲置超过 30 秒才视为可发布
    const STALE_MS = 30_000;
    // 每 10 秒扫描一次
    const SCAN_MS = 10_000;

    /**
     * 扫描并发布闲置草稿。
     */
    const scan = async () => {
      // 从 IndexedDB 读取所有草稿，跳过已标记为发布失败的草稿
      const drafts = await listAllDrafts({ skipFailed: true });
      const now = Date.now();

      for (const draft of drafts) {
        // 跳过已标记为发布的草稿
        if (draft.published) continue;
        // 跳过最近 30 秒内还有更新的草稿（用户可能还在编辑）
        if (now - draft.updatedAt < STALE_MS) continue;

        try {
          // 调用 App.tsx 传入的发布函数
          await onPublishDraftRef.current(draft.documentId);
        } catch (err) {
          console.log("[autoPublish] scan publish failed:", err);
        }
      }
    };

    // 立即执行第一次扫描
    void scan();
    // 设置定时扫描
    const interval = setInterval(scan, SCAN_MS);
    // 清理函数：组件卸载或 enabled 变化时清除定时器
    return () => clearInterval(interval);
  }, [enabled]);
}
