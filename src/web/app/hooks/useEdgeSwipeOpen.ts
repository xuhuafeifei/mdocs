/**
 * 窄屏从左边缘右滑打开侧栏（文档树 / 设置导航）。
 * 仅在抽屉关闭时监听，避免与侧栏内滚动冲突。
 */
import { useEffect, useRef } from "react";

const EDGE_PX = 28;
const THRESHOLD_PX = 56;
const MAX_VERTICAL_RATIO = 0.75;

export function useEdgeSwipeOpen(enabled: boolean, onOpen: () => void): void {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (!enabled) return;

    let tracking = false;
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || t.clientX > EDGE_PX) return;
      tracking = true;
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
        tracking = false;
        return;
      }
      if (dx >= THRESHOLD_PX) {
        tracking = false;
        onOpenRef.current();
      }
    };

    const onTouchEnd = () => {
      tracking = false;
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
  }, [enabled]);
}
