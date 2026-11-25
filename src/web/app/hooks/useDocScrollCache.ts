import { useEffect, useRef, type RefObject } from "react";

import { getDocScroll, setDocScroll } from "../../storage/docScrollCache";

/** 无手势时最长对抗自动置底的时间（安全阀；真正结束靠滚轮/触摸） */
const RESTORE_MAX_MS = 12000;

/**
 * 记住 / 恢复文档滚动容器位置（进程内 LRU，见 docScrollCache）。
 * `ready` 为 true 后再恢复，避免内容未撑开时 maxScroll=0。
 *
 * 注意：
 * - Lexical / focus 常会把视口拽到底；在用户滚轮或触摸前，持续拉回目标位置（有缓存用缓存，否则置顶）。
 * - 卸载时 host 内容常被拆掉，scrollTop 会变 0；清理时必须用「最后一次真实滚动」落盘。
 * - 不用 pointerdown 当作手势：点击聚焦时编辑器往往已在底部，会误把置底写进缓存。
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
  /** 该 documentId 下最后一次用户认可的滚动 */
  const lastPosRef = useRef({ top: 0, left: 0 });
  /** 恢复目标：有缓存用缓存，否则 0（对抗默认置底） */
  const targetRef = useRef({ top: 0, left: 0 });

  useEffect(() => {
    userGestureRef.current = false;
    inRestoreWindowRef.current = false;
    restoreGenRef.current += 1;
    lastPosRef.current = { top: 0, left: 0 };
    targetRef.current = { top: 0, left: 0 };
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

      // 恢复窗口内、或未发生用户手势前：不要把编辑器自动滚记进 lastPos
      const allowRecord =
        !collapsed &&
        userGestureRef.current &&
        !restoringRef.current &&
        !inRestoreWindowRef.current;
      if (allowRecord) {
        lastPosRef.current = { top, left };
        persistLast();
      }
    };

    const markGesture = () => {
      userGestureRef.current = true;
      inRestoreWindowRef.current = false;
      lastPosRef.current = { top: host.scrollTop, left: host.scrollLeft };
      persistLast();
    };

    host.addEventListener("scroll", onScroll, { passive: true });
    // 仅滚轮 / 触摸视为用户要停在当前位置；点击聚焦不算
    host.addEventListener("wheel", markGesture, { passive: true });
    host.addEventListener("touchstart", markGesture, { passive: true });

    return () => {
      host.removeEventListener("scroll", onScroll);
      host.removeEventListener("wheel", markGesture);
      host.removeEventListener("touchstart", markGesture);
      let { top, left } = lastPosRef.current;
      // 卸载瞬间若 lastPos 仍是初值，但 host 还有真实滚动，补一次（进出设置）
      if (top < 1 && left < 1) {
        const collapsed =
          host.scrollHeight <= host.clientHeight + 1 && host.scrollTop < 1;
        if (!collapsed && (host.scrollTop > 0 || host.scrollLeft > 0)) {
          top = host.scrollTop;
          left = host.scrollLeft;
        }
      }
      if (top > 0 || left > 0) {
        setDocScroll(documentId, top, left);
      }
    };
  }, [documentId, hostRef, ready]);

  // 打开后恢复：用户手势前持续对抗编辑器自动置底
  useEffect(() => {
    if (!ready || !documentId) return;
    const host = hostRef.current;
    if (!host) return;

    const saved = getDocScroll(documentId);
    const targetTop = saved?.scrollTop ?? 0;
    const targetLeft = saved?.scrollLeft ?? 0;
    targetRef.current = { top: targetTop, left: targetLeft };
    // 无缓存时也要进恢复窗，把默认置底拉回顶部
    lastPosRef.current = { top: targetTop, left: targetLeft };

    const gen = restoreGenRef.current;
    let stopped = false;
    userGestureRef.current = false;
    inRestoreWindowRef.current = true;

    const apply = () => {
      if (stopped || gen !== restoreGenRef.current || userGestureRef.current) {
        return;
      }
      const el = hostRef.current;
      if (!el) return;
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      // 内容还没撑开：稍后再试（目标 >0 时）
      if (targetRef.current.top > 0 && maxTop <= 0) return;

      const wantTop = Math.min(targetRef.current.top, maxTop);
      const wantLeft = Math.min(targetRef.current.left, maxLeft);
      if (
        Math.abs(el.scrollTop - wantTop) < 2 &&
        Math.abs(el.scrollLeft - wantLeft) < 2
      ) {
        return;
      }

      restoringRef.current = true;
      el.scrollTop = wantTop;
      el.scrollLeft = wantLeft;
      lastPosRef.current = { top: wantTop, left: wantLeft };
      queueMicrotask(() => {
        restoringRef.current = false;
      });
    };

    apply();
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });
    const timers = [80, 200, 500, 1000, 2000, 4000, 8000].map((ms) =>
      window.setTimeout(apply, ms),
    );
    const tStop = window.setTimeout(() => {
      stopped = true;
      inRestoreWindowRef.current = false;
    }, RESTORE_MAX_MS);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => apply())
        : null;
    ro?.observe(host);

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
