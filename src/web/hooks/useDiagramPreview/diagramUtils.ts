/**
 * Pure utility functions for diagram block operations.
 * These functions are designed to be easily testable.
 */

export const META2_SOURCE_SELECTOR =
  ".vditor-wysiwyg__pre > code.language-meta2, .vditor-wysiwyg__pre > code.language-meta";
/** Wysiwyg: preview is usually `pre > code`, not `preview > code` direct child. */
export const META2_PREVIEW_SELECTOR =
  ".vditor-wysiwyg__preview code.language-meta2, .vditor-wysiwyg__preview code.language-meta";
export const BLOCK_SELECTOR = ".vditor-wysiwyg__block";

/** Editable ZWSP slot at end of diagram preview so a real blinking caret can sit after the SVG. */
export const META2_CARET_ANCHOR_CLASS = "mdocs-meta2-caret-anchor";

/**
 * 预览区是「展示用」，不应让光标/Delete 改到 DOM；否则 Lute 重绘、HUD 会错位成「脱落」.
 * 末尾 `META2_CARET_ANCHOR_CLASS` 为刻意可编辑占位，不拦截键盘。
 */
export function isNodeInsideMeta2Preview(node: Node | null, container: Element): boolean {
  if (!node) {
    return false;
  }
  const el = node instanceof Element ? node : node.parentElement;
  if (!el || !container.contains(el)) {
    return false;
  }
  if (el.closest(`.${META2_CARET_ANCHOR_CLASS}`)) {
    return false;
  }
  const previewRoot = el.closest(".vditor-wysiwyg__preview");
  if (!previewRoot) {
    return false;
  }
  const block = previewRoot.closest(BLOCK_SELECTOR);
  if (!block || !container.contains(block)) {
    return false;
  }
  return block.querySelector(META2_SOURCE_SELECTOR) != null;
}

/**
 * Seal preview code so the browser / Vditor don't treat SVG as an editable run.
 */
export function sealMeta2PreviewCode(previewCode: HTMLElement): void {
  previewCode.setAttribute("contenteditable", "false");
  previewCode.setAttribute("spellcheck", "false");
  previewCode.setAttribute("autocapitalize", "off");
}

/**
 * Finds all chart blocks within a container element.
 */
export function findChartBlocks(root: Element): Element[] {
  return Array.from(root.querySelectorAll(BLOCK_SELECTOR)).filter(
    (block) => block.querySelector(META2_SOURCE_SELECTOR) != null,
  );
}

/**
 * Identifies if a target element is within a chart block.
 * Returns the block element if found, null otherwise.
 */
export function identifyChartBlock(target: EventTarget | null, container: Element): Element | null {
  if (!(target instanceof Node)) return null;
  const el = target instanceof Element ? target : target.parentElement;
  if (!el) return null;
  const block = el.closest(BLOCK_SELECTOR);
  if (!block || !container.contains(block)) return null;
  return block.querySelector(META2_SOURCE_SELECTOR) ? block : null;
}

/**
 * Parses diagram JSON payload.
 * Returns { success: true, data } on success, { success: false, error } on failure.
 */
export function parseDiagramPayload(payload: string): { success: true; data: unknown } | { success: false; error: string } {
  if (!payload) {
    return { success: false, error: "Empty payload" };
  }
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { success: false, error: "Invalid diagram JSON: not an object" };
    }
    return { success: true, data: parsed };
  } catch {
    return { success: false, error: "Invalid diagram JSON: parse failed" };
  }
}

/**
 * Calculates toolbar position based on block element and viewport.
 */
export interface Position {
  top: number;
  left: number;
}

export function calculateToolbarPosition(block: Element, toolbarWidth = 76, offset = 6): Position {
  const rect = block.getBoundingClientRect();
  return {
    top: Math.max(4, rect.top + offset),
    left: Math.max(4, rect.right - toolbarWidth - offset),
  };
}

/**
 * 清掉 Vditor 在点击/重排时可能写在 pre、preview 上的 `display` inline，让 App.css 里 meta2 的 :has 规则稳定生效。
 * 不要在这里再写 `display: none/''`：会和删块过程打架，出现一瞬「回到源码+按钮掉进正文」。
 */
export function showPreviewView(block: Element): void {
  const srcNode = block.querySelector(".vditor-wysiwyg__pre") as HTMLElement | null;
  const viewNode = block.querySelector(".vditor-wysiwyg__preview") as HTMLElement | null;
  if (srcNode) {
    srcNode.style.removeProperty("display");
  }
  if (viewNode) {
    viewNode.style.removeProperty("display");
  }
}

/**
 * 在预览列末尾（HUD 前）插入可编辑占位，承载真实文本光标闪烁。
 */
export function ensureMeta2CaretAnchor(preview: HTMLElement): HTMLElement {
  let el = preview.querySelector(`:scope > .${META2_CARET_ANCHOR_CLASS}`) as HTMLElement | null;
  if (!el) {
    el = document.createElement("span");
    el.className = META2_CARET_ANCHOR_CLASS;
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "false");
    el.setAttribute("translate", "no");
    el.setAttribute("data-mdocs-meta2-caret", "1");
    el.appendChild(document.createTextNode("\u200b"));
  }
  const hud = preview.querySelector(":scope > .mdocs-diagram-hud");
  if (hud) {
    preview.insertBefore(el, hud);
  } else {
    preview.appendChild(el);
  }
  return el;
}

export function removeMeta2CaretAnchors(preview: Element): void {
  preview.querySelectorAll(`.${META2_CARET_ANCHOR_CLASS}`).forEach((n) => n.remove());
}

/**
 * After intercepting meta2 block clicks (preventDefault), focus the trailing caret anchor (blinking cursor).
 */
export function focusCaretAtEndOfMeta2Block(block: Element): void {
  const wysiwyg = block.closest(".vditor-wysiwyg") as HTMLElement | null;
  const preview = block.querySelector(".vditor-wysiwyg__preview") as HTMLElement | null;
  if (!wysiwyg || !preview) return;

  const anchor = ensureMeta2CaretAnchor(preview);
  wysiwyg.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  try {
    const tn = anchor.firstChild;
    if (tn && tn.nodeType === Node.TEXT_NODE && tn.textContent && tn.textContent.length > 0) {
      const len = tn.textContent.length;
      range.setStart(tn, len);
      range.collapse(true);
    } else {
      range.selectNodeContents(anchor);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    try {
      range.selectNodeContents(anchor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      // ignore
    }
  }
}

/** Window-attached editor used for meta2 block line/range edits */
export interface VditorInstance {
  getValue(): string;
  setValue?(md: string): void;
}

/**
 * Gets Vditor instance from window.
 */
export function getVditor(): VditorInstance | null {
  const v = (window as unknown as { vditorInstance?: unknown }).vditorInstance;
  if (v && typeof (v as VditorInstance).getValue === "function") return v as VditorInstance;
  return null;
}
