/**
 * useDiagramPreview — Vditor wysiwyg: meta2 preview (SVG) + corner hover HUD (Edit/Delete).
 */

import { useEffect, useCallback } from "react";
import { useDiagramRenderer } from "./useDiagramRenderer";
import { useBlockActions } from "./useBlockActions";
import {
  identifyChartBlock,
  isNodeInsideMeta2Preview,
  showPreviewView,
  focusCaretAtEndOfMeta2Block,
  META2_CARET_ANCHOR_CLASS,
} from "./diagramUtils";
import { MDOCS_DIAGRAM_HUD_EVENT, type MdocsDiagramHudDetail } from "./diagramHud";

export function useDiagramPreview(
  editorRootRef: React.RefObject<HTMLDivElement | null>,
  onActivateDiagram: (
    lineNumber: number,
    flowData: unknown,
    blockIndex: number,
    rawJson: string,
  ) => void,
  isLocked = false,
) {
  const { queueRefresh } = useDiagramRenderer(editorRootRef, isLocked);

  const { onEdit, onDelete } = useBlockActions(
    { containerRef: editorRootRef, isLocked },
    onActivateDiagram,
  );

  /**
   * 在可编辑 wysiwyg 里，若选区/焦点落在 meta2 的 **预览** 上，按 Backspace/Delete 会改坏 innerHTML、触发表内重排，
   * 悬浮条会「脱落」、图表与 JSON 也会不一致。在捕获阶段拦掉，并配合 preview code 的 contenteditable=false。
   */
  const handleKeyDownCapture = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") {
        return;
      }
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
        return;
      }
      if (t instanceof HTMLElement) {
        if (t.closest(".mdocs-modal-backdrop, .mdocs-flow-modal")) {
          return;
        }
      }
      const container = editorRootRef.current;
      if (!container) {
        return;
      }
      const blockDeleteInMeta2Preview = (): boolean => {
        const hit = (n: Node | null) => isNodeInsideMeta2Preview(n, container);
        const sel = window.getSelection();
        if (sel?.rangeCount) {
          if (hit(sel.anchorNode) || hit(sel.focusNode)) {
            return true;
          }
        }
        if (e.target instanceof Node) {
          if (hit(e.target)) {
            return true;
          }
        }
        if (document.activeElement instanceof Node) {
          if (hit(document.activeElement)) {
            return true;
          }
        }
        return false;
      };
      if (blockDeleteInMeta2Preview()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [editorRootRef],
  );

  // Click: keep showing preview, but do not capture clicks meant for the corner HUD (otherwise buttons never receive them).
  const handleCaretAnchorInput = useCallback(
    (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      const el = t instanceof Element ? t : t.parentElement;
      const a = el?.closest(`.${META2_CARET_ANCHOR_CLASS}`);
      const root = editorRootRef.current;
      if (!a || !root?.contains(a)) return;
      if (!a.textContent?.length) {
        (a as HTMLElement).textContent = "\u200b";
        const sel = window.getSelection();
        const tn = a.firstChild;
        if (sel && tn?.nodeType === Node.TEXT_NODE) {
          const r = document.createRange();
          r.setStart(tn, tn.textContent?.length ?? 1);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }
    },
    [editorRootRef],
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (e.target instanceof Element) {
        const t = e.target;
        if (t.closest(`.${META2_CARET_ANCHOR_CLASS}`)) {
          return;
        }
        if (
          t.closest("button, .mdocs-diagram-hud, [data-mdocs-hud]") ||
          t.closest(".vditor-copy")
        ) {
          return;
        }
      }
      const container = editorRootRef.current;
      if (!container) {
        return;
      }
      const block = identifyChartBlock(e.target, container);
      if (!block) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      showPreviewView(block);
      queueMicrotask(() => {
        focusCaretAtEndOfMeta2Block(block);
      });
    },
    [editorRootRef],
  );

  useEffect(() => {
    const container = editorRootRef.current;
    if (!container) {
      return;
    }

    const onHud = (ev: Event) => {
      if (!(ev instanceof CustomEvent)) {
        return;
      }
      const d = ev.detail as MdocsDiagramHudDetail;
      if (!d?.action || !d?.block) {
        return;
      }
      if (d.action === "edit") {
        onEdit(d.block);
      } else {
        onDelete(d.block);
      }
    };
    container.addEventListener(MDOCS_DIAGRAM_HUD_EVENT, onHud);

    const observer = new MutationObserver(queueRefresh);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    container.addEventListener("click", handleClick, true);
    container.addEventListener("keydown", handleKeyDownCapture, true);
    container.addEventListener("input", handleCaretAnchorInput, true);

    return () => {
      container.removeEventListener(MDOCS_DIAGRAM_HUD_EVENT, onHud);
      observer.disconnect();
      container.removeEventListener("click", handleClick, true);
      container.removeEventListener("keydown", handleKeyDownCapture, true);
      container.removeEventListener("input", handleCaretAnchorInput, true);
    };
  }, [editorRootRef, queueRefresh, handleClick, handleKeyDownCapture, handleCaretAnchorInput, onEdit, onDelete]);
}

export const useFlowRenderer = useDiagramPreview;

export {
  findChartBlocks,
  identifyChartBlock,
  isNodeInsideMeta2Preview,
  parseDiagramPayload,
  calculateToolbarPosition,
  showPreviewView,
  getVditor,
  META2_SOURCE_SELECTOR,
  META2_PREVIEW_SELECTOR,
  BLOCK_SELECTOR,
} from "./diagramUtils";

export type { ToolbarState } from "./useToolbar";
export type { Position } from "./diagramUtils";
