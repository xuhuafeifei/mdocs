import { useEffect, useRef, type RefObject } from "react";

import { getDocScroll, setDocScroll } from "../../storage/docScrollCache";

const RESTORE_MS = 4000;

/**
 * 记住 / 恢复文档滚动容器位置（进程内 LRU，见 docScrollCache）。
 * `ready` 为 true 后再恢复，避免内容未撑开时 maxScroll=0。
 *
 * 注意：
 * - 卸载时 host 内容常被拆掉，scrollTop 会变 0；清理时必须用「最后一次真实滚动」落盘。
 * - Lexical 初始化常会把视口拽到底；恢复窗口内只认滚轮/触摸/指针为用户手势，并持续拉回缓存位置。
 */
export function useDocScrollCache(
  documentId: string,
  hostRef: RefObject<HTMLElement | null>,
  ready: boolean,
): void {
  const userGestureRef = useRef(false);
  const restoringRef = useRef(false);
  const inRestoreWindowRef = useRef(false);
  const restoreGenRef = useRef(0);
  /** 该 documentId 下最后一次非「空内容塌缩」的滚动 */
  const lastPosRef = useRef({ top: 0, left: 0 });

  useEffect(() => {
    userGestureRef.current = false;
    inRestoreWindowRef.current = false;
    restoreGenRef.current += 1;
    lastPosRef.current = { top: 0, left: 0 };
  }, [documentId]);

  // 滚动时写入缓存；卸载时用 lastPos，避免内容清空后的 0 覆盖
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !documentId) return;

    const persistLast = () => {
      const { top, left } = lastPosRef.current;
      // 恢复窗口里中间态的 0 不要抹掉已有缓存
      if (inRestoreWindowRef.current && top === 0 && left === 0) return;
      setDocScroll(documentId, top, left);
    };

    const onScroll = () => {
      const top = host.scrollTop;
      const left = host.scrollLeft;
      // 内容被拆掉时 scrollHeight 塌缩，忽略这次 0，保留 lastPos
      const collapsed =
        host.scrollHeight <= host.clientHeight + 1 && top < 1 && left < 1;

      // 恢复窗口内编辑器自动滚到底：不要把 bottom 写进 lastPos
      const allowRecord =
        !collapsed &&
        (!inRestoreWindowRef.current || userGestureRef.current) &&
        !restoringRef.current;
      if (allowRecord) {
        lastPosRef.current = { top, left };
      }

      if (restoringRef.current || inRestoreWindowRef.current) {
        if (!userGestureRef.current) return;
      }
      persistLast();
    };

    const markGesture = () => {
      userGestureRef.current = true;
      inRestoreWindowRef.current = false;
      lastPosRef.current = { top: host.scrollTop, left: host.scrollLeft };
      persistLast();
    };

    host.addEventListener("scroll", onScroll, { passive: true });
    host.addEventListener("wheel", markGesture, { passive: true });
    host.addEventListener("touchstart", markGesture, { passive: true });
    host.addEventListener("pointerdown", markGesture, { passive: true });

    return () => {
      host.removeEventListener("scroll", onScroll);
      host.removeEventListener("wheel", markGesture);
      host.removeEventListener("touchstart", markGesture);
      host.removeEventListener("pointerdown", markGesture);
      const { top, left } = lastPosRef.current;
      if (top > 0 || left > 0) {
        setDocScroll(documentId, top, left);
      }
    };
  }, [documentId, hostRef, ready]);

  // 打开后恢复：短窗口内对抗编辑器自动置底
  useEffect(() => {
    if (!ready || !documentId) return;
    const host = hostRef.current;
    if (!host) return;

    const saved = getDocScroll(documentId);
    if (!saved || (saved.scrollTop === 0 && saved.scrollLeft === 0)) return;

    const gen = restoreGenRef.current;
    let stopped = false;
    inRestoreWindowRef.current = true;

    const apply = () => {
      if (stopped || gen !== restoreGenRef.current || userGestureRef.current) {
        return;
      }
      const el = hostRef.current;
      if (!el) return;
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      if (saved.scrollTop > 0 && maxTop <= 0) return;

      const targetTop = Math.min(saved.scrollTop, maxTop);
      const targetLeft = Math.min(saved.scrollLeft, maxLeft);
      if (
        Math.abs(el.scrollTop - targetTop) < 2 &&
        Math.abs(el.scrollLeft - targetLeft) < 2
      ) {
        return;
      }

      restoringRef.current = true;
      el.scrollTop = targetTop;
      el.scrollLeft = targetLeft;
      lastPosRef.current = { top: targetTop, left: targetLeft };
      queueMicrotask(() => {
        restoringRef.current = false;
      });
    };

    apply();
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });
    const timers = [80, 200, 500, 1000, 2000, 3000].map((ms) =>
      window.setTimeout(apply, ms),
    );
    const tStop = window.setTimeout(() => {
      stopped = true;
      inRestoreWindowRef.current = false;
    }, RESTORE_MS);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => apply())
        : null;
    ro?.observe(host);

    // 恢复窗口内：任何非手势滚动（编辑器自动滚）都拉回
    const onScrollGuard = () => {
      if (!inRestoreWindowRef.current || userGestureRef.current) return;
      apply();
    };
    host.addEventListener("scroll", onScrollGuard, { passive: true });

    return () => {
      stopped = true;
      inRestoreWindowRef.current = false;
      cancelAnimationFrame(raf);
      for (const t of timers) window.clearTimeout(t);
      window.clearTimeout(tStop);
      ro?.disconnect();
      host.removeEventListener("scroll", onScrollGuard);
    };
  }, [documentId, hostRef, ready]);
}
