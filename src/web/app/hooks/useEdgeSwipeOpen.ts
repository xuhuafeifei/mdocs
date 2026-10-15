/**
 * 窄屏侧栏：push 跟手（目录与正文一条轨道），不是浮层盖住。
 * - 关→开：右滑露出目录，正文被挤出
 * - 开→关：左滑收回
 * - 竖向滚动优先：明显竖滑立刻放弃，避免非 passive 监听拖住原生滚动
 * - 横向还能滚的表格：先滚表，到头再开门
 */
import { useEffect, useState, type RefObject } from "react";

const CLAIM_PX = 22;
const SETTLE_RATIO = 0.4;
const VELOCITY_FLIP = 0.4;
/** 竖向占优时立刻让出，阈值要低，否则第一下滚动被拖住 */
const VERTICAL_BAIL_PX = 8;

export function mobileNavPanelWidthPx(): number {
  if (typeof window === "undefined") return 300;
  return Math.min(300, Math.round(window.innerWidth * 0.86));
}

/** 向上找可横向滚动的祖先（sheet / md table 外层等）。 */
export function findHorizontalScrollParent(start: EventTarget | null): HTMLElement | null {
  let node: Element | null = start instanceof Element ? start : null;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const { overflowX } = getComputedStyle(node);
      if (
        (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") &&
        node.scrollWidth > node.clientWidth + 1
      ) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

/** 向上找可竖向滚动的祖先。 */
export function findVerticalScrollParent(start: EventTarget | null): HTMLElement | null {
  let node: Element | null = start instanceof Element ? start : null;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const { overflowY } = getComputedStyle(node);
      if (
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

export function hScrollCanAbsorb(el: HTMLElement, dx: number): boolean {
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 1) return false;
  if (dx > 0) return el.scrollLeft > 1;
  if (dx < 0) return el.scrollLeft < max - 1;
  return false;
}

export function useEdgeSwipeOpen(
  enabled: boolean,
  options: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 跟手写入 CSS 变量，避免每帧 setState 打断滚动 */
    layoutRef?: RefObject<HTMLElement | null>;
  },
): { revealPx: number; dragging: boolean } {
  const { open, onOpenChange, layoutRef } = options;
  const [revealPx, setRevealPx] = useState(0);
  const [dragging, setDragging] = useState(false);

  function writeReveal(px: number) {
    const el = layoutRef?.current;
    if (el) el.style.setProperty("--mdocs-nav-reveal", `${px}px`);
  }

  useEffect(() => {
    if (!enabled) {
      setRevealPx(0);
      setDragging(false);
      writeReveal(0);
      return;
    }
    if (!dragging) {
      const px = open ? mobileNavPanelWidthPx() : 0;
      setRevealPx(px);
      writeReveal(px);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在开合/拖拽结束时同步
  }, [enabled, open, dragging]);

  useEffect(() => {
    if (!enabled) return;

    let tracking: "pending" | "open" | "close" | null = null;
    let claimed = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocityX = 0;
    let baseReveal = 0;
    let scrollParent: HTMLElement | null = null;
    let reveal = open ? mobileNavPanelWidthPx() : 0;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const el = e.target;
      if (el instanceof Element && el.closest(".mdocs-agent-fab-wrap")) return;
      if (el instanceof Element && el.closest(".mdocs-agent-panel")) return;

      // 先 pending：等方向明确，避免一上手就按「开目录」抢竖滑
      tracking = "pending";
      claimed = false;
      startX = t.clientX;
      startY = t.clientY;
      lastX = t.clientX;
      lastT = e.timeStamp;
      velocityX = 0;
      baseReveal = open ? mobileNavPanelWidthPx() : 0;
      reveal = baseReveal;
      scrollParent = findHorizontalScrollParent(el);

      // 点在可竖滚区域：若没有可吸的横滚，默认交给内容滚动
      const vScroll = findVerticalScrollParent(el);
      if (vScroll && !(scrollParent && (scrollParent.scrollWidth > scrollParent.clientWidth + 1))) {
        // 仍 pending，但竖向 bail 阈值更敏感（见 move）
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;

      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const dt = e.timeStamp - lastT;
      if (dt > 0) {
        velocityX = (t.clientX - lastX) / dt;
        lastX = t.clientX;
        lastT = e.timeStamp;
      }

      if (!claimed) {
        // 竖向优先：立刻放弃，让浏览器原生滚动，不要等 preventDefault 判决
        if (absDy >= VERTICAL_BAIL_PX && absDy >= absDx) {
          tracking = null;
          return;
        }

        if (tracking === "pending") {
          if (absDx < CLAIM_PX && absDy < CLAIM_PX) return;
          if (absDy >= absDx) {
            tracking = null;
            return;
          }
          if (dx > 0 && !open) tracking = "open";
          else if (dx < 0 && open) tracking = "close";
          else {
            tracking = null;
            return;
          }
        }

        if (absDx < CLAIM_PX) return;
        if (tracking === "open" && dx <= 0) {
          tracking = null;
          return;
        }
        if (tracking === "close" && dx >= 0) {
          tracking = null;
          return;
        }
        if (scrollParent && hScrollCanAbsorb(scrollParent, dx)) {
          tracking = null;
          return;
        }
        claimed = true;
        const layout = layoutRef?.current;
        if (layout) layout.classList.add("is-nav-dragging");
        setDragging(true);
      }

      if (!claimed) return;
      if (e.cancelable) e.preventDefault();

      const w = mobileNavPanelWidthPx();
      reveal = Math.min(w, Math.max(0, baseReveal + dx));
      writeReveal(reveal);
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      const layout = layoutRef?.current;
      if (layout) layout.classList.remove("is-nav-dragging");
      if (!claimed) {
        tracking = null;
        return;
      }
      const w = mobileNavPanelWidthPx();
      let nextOpen = open;
      if (tracking === "open") {
        nextOpen = reveal >= w * SETTLE_RATIO || velocityX > VELOCITY_FLIP;
      } else if (tracking === "close") {
        nextOpen = !(reveal < w * SETTLE_RATIO || velocityX < -VELOCITY_FLIP);
      }
      tracking = null;
      claimed = false;
      setDragging(false);
      writeReveal(nextOpen ? w : 0);
      setRevealPx(nextOpen ? w : 0);
      if (nextOpen !== open) onOpenChange(nextOpen);
    };

    const startOpts: AddEventListenerOptions = { passive: true, capture: true };
    // 仍非 passive：仅在 claimed 后 preventDefault；未声称前尽快 return，降低拖住滚动的概率
    const moveOpts: AddEventListenerOptions = { passive: false, capture: true };
    window.addEventListener("touchstart", onTouchStart, startOpts);
    window.addEventListener("touchmove", onTouchMove, moveOpts);
    window.addEventListener("touchend", onTouchEnd, startOpts);
    window.addEventListener("touchcancel", onTouchEnd, startOpts);
    return () => {
      window.removeEventListener("touchstart", onTouchStart, startOpts);
      window.removeEventListener("touchmove", onTouchMove, moveOpts);
      window.removeEventListener("touchend", onTouchEnd, startOpts);
      window.removeEventListener("touchcancel", onTouchEnd, startOpts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, open, onOpenChange, layoutRef]);

  return { revealPx, dragging };
}
