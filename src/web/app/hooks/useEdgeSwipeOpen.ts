/**
 * 窄屏侧栏抽屉手势：
 * - 关闭时：左缘区域右滑 → 打开
 * - 打开时：左滑 → 关闭（主区 / 遮罩 / 抽屉均可）
 * 纵向滑动明显时取消，避免与目录/正文滚动冲突。
 *
 * Android 全屏手势会吞掉最左侧触摸；起点允许更靠里，并用 capture 抢先收到事件。
 */
import { useEffect, useRef } from "react";

const THRESHOLD_PX = 40;
const MAX_VERTICAL_RATIO = 0.75;

/** 左缘可起滑宽度：至少 96px，至多屏宽 28%（上限 140） */
function openEdgePx(): number {
  if (typeof window === "undefined") return 96;
  return Math.min(140, Math.max(96, Math.round(window.innerWidth * 0.28)));
}

export function useEdgeSwipeOpen(
  enabled: boolean,
  onOpen: () => void,
  options?: { open?: boolean; onClose?: () => void },
): void {
  const open = Boolean(options?.open);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(options?.onClose);
  onOpenRef.current = onOpen;
  onCloseRef.current = options?.onClose;

  useEffect(() => {
    if (!enabled) return;

    let tracking: "open" | "close" | null = null;
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      // DS 悬浮球可拖：起点在 FAB 上时不抢侧栏手势
      const el = e.target;
      if (el instanceof Element && el.closest(".mdocs-agent-fab-wrap")) return;
      if (open) {
        if (!onCloseRef.current) return;
        tracking = "close";
      } else {
        if (t.clientX > openEdgePx()) return;
        tracking = "open";
      }
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dy > Math.abs(dx) * MAX_VERTICAL_RATIO && dy > 24) {
        tracking = null;
        return;
      }
      if (tracking === "open" && dx >= THRESHOLD_PX) {
        tracking = null;
        onOpenRef.current();
        return;
      }
      if (tracking === "close" && dx <= -THRESHOLD_PX) {
        tracking = null;
        onCloseRef.current?.();
      }
    };

    const onTouchEnd = () => {
      tracking = null;
    };

    // capture：比编辑器 / 顶栏更早看到触摸（仍无法越过系统级返回手势）
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchmove", onTouchMove, opts);
    window.addEventListener("touchend", onTouchEnd, opts);
    window.addEventListener("touchcancel", onTouchEnd, opts);
    return () => {
      window.removeEventListener("touchstart", onTouchStart, opts);
      window.removeEventListener("touchmove", onTouchMove, opts);
      window.removeEventListener("touchend", onTouchEnd, opts);
      window.removeEventListener("touchcancel", onTouchEnd, opts);
    };
  }, [enabled, open]);
}
