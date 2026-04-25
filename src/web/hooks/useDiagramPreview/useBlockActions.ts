import { useRef, useCallback } from "react";
import { findMeta2BlockLineNumber, findMeta2BlockRange } from "../../diagram/meta2Markdown";
import { findChartBlocks, getVditor } from "./diagramUtils";

export interface UseBlockActionsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isLocked: boolean;
}

export interface BlockActions {
  onEdit: (block: Element) => void;
  onDelete: (block: Element) => void;
}

/**
 * Hook for managing chart block actions (edit, delete).
 */
export function useBlockActions(
  options: UseBlockActionsOptions,
  onActivateDiagram: (
    lineNumber: number,
    flowData: unknown,
    blockIndex: number,
    rawJson: string,
  ) => void,
): BlockActions {
  const { containerRef, isLocked } = options;
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  const onActivateDiagramRef = useRef(onActivateDiagram);
  onActivateDiagramRef.current = onActivateDiagram;

  /**
   * Opens the diagram editor for the given block.
   */
  const handleEdit = useCallback(
    (block: Element) => {
      if (isLockedRef.current) return;

      const source = block.querySelector(".vditor-wysiwyg__pre > code.language-meta2, .vditor-wysiwyg__pre > code.language-meta");
      const raw = source?.textContent?.trim();
      if (!raw) return;

      try {
        const chartData = JSON.parse(raw);
        const container = containerRef.current;
        const blockIndex = container ? findChartBlocks(container).indexOf(block) : -1;

        let targetLine = -1;
        const editor = getVditor();
        if (editor && blockIndex >= 0) {
          targetLine = findMeta2BlockLineNumber(editor.getValue(), blockIndex);
        }

        onActivateDiagramRef.current(targetLine, chartData, blockIndex, raw);
      } catch (err) {
        console.error("Open diagram editor failed:", err);
      }
    },
    [containerRef],
  );

  /**
   * Removes the chart block from the editor.
   */
  const handleDelete = useCallback((block: Element) => {
    if (isLockedRef.current) return;

    const editor = getVditor();
    if (!editor || typeof editor.getValue !== "function") {
      console.warn("Editor unavailable, cannot remove chart block");
      return;
    }
    if (typeof editor.setValue !== "function") {
      console.warn("Editor setValue unavailable, cannot remove chart block");
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const blockIndex = findChartBlocks(container).indexOf(block);
    if (blockIndex < 0) return;

    const ok = window.confirm("Delete this diagram? This cannot be undone.");
    if (!ok) return;

    const md = editor.getValue();
    const range = findMeta2BlockRange(md, blockIndex);
    if (!range) return;

    const [start, end] = range;
    const lines = md.split("\n");
    lines.splice(start, end - start + 1);
    editor.setValue(lines.join("\n"));
  }, [containerRef]);

  return {
    onEdit: handleEdit,
    onDelete: handleDelete,
  };
}
