/**
 * 版本对比：两栏「按百分比联动滚动」。
 *
 * 只做滚动位置的比例映射，不读取、不比较正文内容（没有 diff）。
 * 两栏各自仍是普通可滚动容器；联动只是把一侧的 scrollTop 换成对侧的 scrollTop。
 */

/** 元素可滚动比例：0 = 顶部，1 = 底部；不可滚动恒为 0。 */
export function scrollRatio(el: Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">): number {
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 0) return 0;
  const ratio = el.scrollTop / max;
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(1, Math.max(0, ratio));
}

/** 把 source 的比例映射成 target 的 scrollTop（取整，避免亚像素抖动）。 */
export function computeSyncedScrollTop(
  source: Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">,
  target: Pick<HTMLElement, "scrollHeight" | "clientHeight">,
): number {
  const max = target.scrollHeight - target.clientHeight;
  if (max <= 0) return 0;
  return Math.round(scrollRatio(source) * max);
}

type ScrollSource = HTMLElement;

/**
 * 让 a / b 两栏比例联动。
 *
 * - 谁被用户操作（wheel / pointerdown / touchstart / keydown / 或它自己的 scroll 先到）谁当 source；
 * - 一帧合并一次同步，避免高频 scroll 抖动；
 * - 程序写入对侧 scrollTop 后标记该侧，吞掉它随后派发的 scroll，防止回环；
 * - 返回解绑函数；解绑后两栏各滚各的。
 */
export function bindProportionalScroll(a: ScrollSource, b: ScrollSource): () => void {
  /** 正在被程序写入的一侧：其 scroll 事件不算用户意图 */
  const writing = new WeakSet<ScrollSource>();
  let source: ScrollSource | null = null;
  let frame = 0;
  let disposed = false;

  const other = (el: ScrollSource): ScrollSource => (el === a ? b : a);

  const align = (): void => {
    frame = 0;
    if (disposed || !source) return;
    const target = other(source);
    const next = computeSyncedScrollTop(source, target);
    if (Math.abs(target.scrollTop - next) < 1) return;
    writing.add(target);
    target.scrollTop = next;
    // scroll 事件在下一帧渲染步骤里派发，晚于本次 rAF 结束后清标记
    requestAnimationFrame(() => {
      writing.delete(target);
    });
  };

  const schedule = (el: ScrollSource): void => {
    source = el;
    if (frame) return;
    frame = requestAnimationFrame(align);
  };

  const makeScrollHandler = (el: ScrollSource) => (): void => {
    if (disposed) return;
    if (writing.has(el)) return;
    schedule(el);
  };

  const makeClaimHandler = (el: ScrollSource) => (): void => {
    source = el;
  };

  const onScrollA = makeScrollHandler(a);
  const onScrollB = makeScrollHandler(b);
  const claimA = makeClaimHandler(a);
  const claimB = makeClaimHandler(b);

  a.addEventListener("scroll", onScrollA, { passive: true });
  b.addEventListener("scroll", onScrollB, { passive: true });
  for (const [el, claim] of [
    [a, claimA],
    [b, claimB],
  ] as const) {
    el.addEventListener("wheel", claim, { passive: true });
    el.addEventListener("pointerdown", claim, { passive: true });
    el.addEventListener("touchstart", claim, { passive: true });
    el.addEventListener("keydown", claim);
  }

  return () => {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    a.removeEventListener("scroll", onScrollA);
    b.removeEventListener("scroll", onScrollB);
    for (const [el, claim] of [
      [a, claimA],
      [b, claimB],
    ] as const) {
      el.removeEventListener("wheel", claim);
      el.removeEventListener("pointerdown", claim);
      el.removeEventListener("touchstart", claim);
      el.removeEventListener("keydown", claim);
    }
  };
}
