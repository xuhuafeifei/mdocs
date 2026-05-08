/**
 * 发布保护 Hook
 * 当编辑器中有未保存到 IndexedDB 的变更时，拦截浏览器关闭/刷新事件，防止用户意外丢失内容。
 * 若草稿已保存到 IndexedDB，则允许正常关闭（因为数据已在本地持久化）。
 */
import { useEffect } from "react";

interface UsePublishGuardOptions {
  isDirty: boolean;
  draftExists: boolean;
}

/**
 * 发布保护 Hook：当编辑器中有未保存到 IndexedDB 的变更时，拦截浏览器关闭/刷新事件。
 */
export function usePublishGuard({ isDirty, draftExists }: UsePublishGuardOptions) {
  // 仅在「内容已变但草稿尚未写入 IndexedDB」时拦截，避免过度提示
  const shouldBlock = isDirty && !draftExists;

  useEffect(() => {
    // 不需要拦截时直接返回
    if (!shouldBlock) return;
    const handler = (e: BeforeUnloadEvent) => {
      // 调用 preventDefault() 会触发浏览器的「离开此网站？」确认框
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    // 清理函数：移除监听
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);
}
