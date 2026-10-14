/**
 * 窄屏侧栏抽屉手势：
 * - 关闭时：左边缘右滑 → 打开
 * - 打开时：左滑 → 关闭（主区 / 遮罩 / 抽屉均可）
 * 纵向滑动明显时取消，避免与目录/正文滚动冲突。
 */
import { useEffect, useRef } from "react";

// Android 系统返回手势会抢最边缘触摸；允许从更宽的安全区起滑。
const EDGE_PX = 64;
const THRESHOLD_PX = 44;
const MAX_VERTICAL_RATIO = 0.75;

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
        if (t.clientX > EDGE_PX) return;
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

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, open]);
}
