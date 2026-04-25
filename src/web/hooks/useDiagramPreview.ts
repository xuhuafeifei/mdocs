import { useEffect, useRef } from "react";
import { renderDiagramToImage, discardCachedPreview } from "../meta2d/renderEngine";

const SOURCE_SELECTOR =
  ".vditor-wysiwyg__pre > code.language-meta2, .vditor-wysiwyg__pre > code.language-meta";
const PREVIEW_SELECTOR =
  ".vditor-wysiwyg__preview > code.language-meta2, .vditor-wysiwyg__preview > code.language-meta";

const BLOCK_OPEN_PATTERN = /^\s*```(meta2|meta)\b/;

function locateBlockStartLine(markdown: string, blockIndex: number): number {
  const lines = markdown.split("\n");
  let count = -1;
  for (let i = 0; i < lines.length; i++) {
    if (BLOCK_OPEN_PATTERN.test(lines[i] ?? "")) {
      count++;
      if (count === blockIndex) {
        return i + 1;
      }
    }
  }
  return -1;
}

function locateBlockBoundaries(
  markdown: string,
  blockIndex: number,
): [number, number] | null {
  const lines = markdown.split("\n");
  let count = -1;
  for (let i = 0; i < lines.length; i++) {
    if (BLOCK_OPEN_PATTERN.test(lines[i] ?? "")) {
      count++;
      if (count === blockIndex) {
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s*```\s*$/.test(lines[j] ?? "")) {
            return [i, j];
          }
        }
        return [i, lines.length - 1];
      }
    }
  }
  return null;
}

function collectDiagramBlocks(container: Element): Element[] {
  return Array.from(
    container.querySelectorAll(".vditor-wysiwyg__block"),
  ).filter((b) => b.querySelector(SOURCE_SELECTOR));
}

const ICON_EDIT = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.811l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064l6.286-6.287Z"/></svg>`;

const ICON_REMOVE = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675a.75.75 0 1 0-1.492.15l.66 6.6A1.75 1.75 0 0 0 5.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 0 0-1.492-.149l-.66 6.6a.25.25 0 0 1-.249-.225h-5.19a.25.25 0 0 1-.249-.225l-.66-6.6Z"/></svg>`;

export function useDiagramPreview(
  editorRootRef: React.RefObject<HTMLDivElement | null>,
  onActivateDiagram: (lineNumber: number, flowData: any) => void,
  isLocked = false,
) {
  const onActivateDiagramRef = useRef(onActivateDiagram);
  onActivateDiagramRef.current = onActivateDiagram;
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  useEffect(() => {
    const container = editorRootRef.current;
    if (!container) return;

    let delayTimer: number;

    const scanAndRenderBlocks = () => {
      const blocks = container.querySelectorAll(".vditor-wysiwyg__block");
      for (const block of blocks) {
        const sourceCode = block.querySelector(SOURCE_SELECTOR);
        const previewCode = block.querySelector(
          PREVIEW_SELECTOR,
        ) as HTMLElement | null;

        if (!(sourceCode instanceof HTMLElement) || !previewCode) continue;

        const jsonStr = sourceCode.textContent?.trim() ?? "";

        if (!jsonStr) {
          if (
            previewCode.innerHTML ||
            previewCode.getAttribute("data-processed") === "true"
          ) {
            discardCachedPreview(previewCode);
            previewCode.removeAttribute("data-processed");
            delete previewCode.dataset.diagramSrc;
            previewCode.textContent = "";
          }
          continue;
        }

        if (
          previewCode.getAttribute("data-processed") === "true" &&
          previewCode.dataset.diagramSrc === jsonStr
        ) {
          continue;
        }

        try {
          JSON.parse(jsonStr);
        } catch {
          discardCachedPreview(previewCode);
          previewCode.removeAttribute("data-processed");
          delete previewCode.dataset.diagramSrc;
          previewCode.textContent = "无效的 meta2 JSON";
          continue;
        }

        renderDiagramToImage(jsonStr, (blob) => {
          if (!block.isConnected) return;

          const sc = block.querySelector(SOURCE_SELECTOR);
          const pc = block.querySelector(
            PREVIEW_SELECTOR,
          ) as HTMLElement | null;
          if (!sc || !pc) return;

          const current = sc.textContent?.trim() ?? "";
          if (current !== jsonStr) return;

          discardCachedPreview(pc);

          if (!blob || blob.size === 0) {
            pc.textContent = "流程图渲染失败";
            pc.setAttribute("data-processed", "true");
            pc.dataset.diagramSrc = jsonStr;
            return;
          }

          const url = URL.createObjectURL(blob);
          pc.dataset.diagramBlobUrl = url;
          pc.innerHTML = `<img src="${url}" alt="流程图" style="display:block;max-width:100%;height:auto;" draggable="false" />`;
          pc.setAttribute("data-processed", "true");
          pc.dataset.diagramSrc = jsonStr;
        });
      }
    };

    const scheduleScan = () => {
      window.clearTimeout(delayTimer);
      delayTimer = window.setTimeout(scanAndRenderBlocks, 300);
    };

    const observer = new MutationObserver(scheduleScan);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scanAndRenderBlocks();

    const resolveDiagramBlock = (target: EventTarget | null): Element | null => {
      if (!(target instanceof Node)) return null;
      const el = target instanceof Element ? target : target.parentElement;
      if (!el) return null;
      const block = el.closest(".vditor-wysiwyg__block");
      if (!block || !container.contains(block)) return null;
      const hasMeta2 = block.querySelector(SOURCE_SELECTOR);
      return hasMeta2 ? block : null;
    };

    const toolbar = document.createElement("div");
    toolbar.className = "meta2-flow-overlay";
    toolbar.style.cssText = [
      "position: fixed",
      "z-index: 1500",
      "display: none",
      "flex-direction: column",
      "align-items: stretch",
      "gap: 0",
      "padding: 4px",
      "background: rgba(255,255,255,0.92)",
      "border: 1px solid #d0d7de",
      "border-radius: 6px",
      "box-shadow: 0 1px 3px rgba(0,0,0,0.08)",
      "pointer-events: auto",
    ].join(";");

    const buildBtn = (html: string, title: string): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.title = title;
      b.innerHTML = html;
      b.style.cssText = [
        "display: inline-flex",
        "align-items: center",
        "justify-content: center",
        "width: 24px",
        "height: 24px",
        "padding: 0",
        "border: none",
        "background: transparent",
        "color: #1a4fd8",
        "cursor: pointer",
        "border-radius: 4px",
      ].join(";");
      b.addEventListener("mouseenter", () => {
        b.style.background = "#eef3ff";
      });
      b.addEventListener("mouseleave", () => {
        b.style.background = "transparent";
      });
      return b;
    };

    const editBtn = buildBtn(ICON_EDIT, "编辑流程图");
    const delBtn = buildBtn(ICON_REMOVE, "删除流程图");
    delBtn.style.color = "#c7254e";

    const btnRow = document.createElement("div");
    btnRow.style.cssText =
      "display:flex;flex-direction:row;gap:4px;justify-content:flex-end;";
    btnRow.appendChild(editBtn);
    btnRow.appendChild(delBtn);
    toolbar.appendChild(btnRow);
    document.body.appendChild(toolbar);

    let currentNode: Element | null = null;
    let dismissTimer: number | undefined;

    const positionToolbar = (block: Element) => {
      const r = block.getBoundingClientRect();
      toolbar.style.display = "flex";
      toolbar.style.top = `${Math.max(4, r.top + 6)}px`;
      toolbar.style.left = `${Math.max(4, r.right - 70 - 6)}px`;
    };

    const showToolbarFor = (block: Element) => {
      window.clearTimeout(dismissTimer);
      currentNode = block;
      btnRow.style.display = isLockedRef.current ? "none" : "flex";
      positionToolbar(block);
    };

    const scheduleHide = () => {
      window.clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(() => {
        toolbar.style.display = "none";
        currentNode = null;
      }, 120);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const block = resolveDiagramBlock(e.target);
      if (block) showToolbarFor(block);
    };
    const handleMouseOut = (e: MouseEvent) => {
      const block = resolveDiagramBlock(e.target);
      if (!block) return;
      const to = e.relatedTarget as Node | null;
      if (to && toolbar.contains(to)) return;
      scheduleHide();
    };

    toolbar.addEventListener("mouseenter", () => {
      window.clearTimeout(dismissTimer);
    });
    toolbar.addEventListener("mouseleave", scheduleHide);

    const onScrollOrResize = () => {
      if (currentNode && currentNode.isConnected) {
        positionToolbar(currentNode);
      } else {
        toolbar.style.display = "none";
      }
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    const openEditorForBlock = (block: Element) => {
      if (isLockedRef.current) return;
      const sourceCode = block.querySelector(SOURCE_SELECTOR);
      const raw = sourceCode?.textContent?.trim();
      if (!raw) return;
      try {
        const flowData = JSON.parse(raw);
        const blockIndex = collectDiagramBlocks(container).indexOf(block);

        let targetLine = -1;
        const activeEditor = (window as any).activeEditor;
        if (
          activeEditor &&
          typeof activeEditor.getValue === "function" &&
          blockIndex >= 0
        ) {
          const md = activeEditor.getValue();
          targetLine = locateBlockStartLine(md, blockIndex);
        }
        onActivateDiagramRef.current(targetLine, flowData);
      } catch (err) {
        console.error("Failed to open flow editor:", err);
      }
    };

    const deleteBlock = (block: Element) => {
      if (isLockedRef.current) return;
      const activeEditor = (window as any).activeEditor;
      if (!activeEditor || typeof activeEditor.getValue !== "function") {
        return;
      }
      if (typeof activeEditor.setValue !== "function") {
        console.warn("vditor setValue unavailable, cannot delete meta2 block");
        return;
      }
      const blockIndex = collectDiagramBlocks(container).indexOf(block);
      if (blockIndex < 0) return;

      const ok = window.confirm("确定删除此流程图吗？此操作不可撤销。");
      if (!ok) return;

      const md = activeEditor.getValue();
      const range = locateBlockBoundaries(md, blockIndex);
      if (!range) return;
      const [start, end] = range;
      const lines = md.split("\n");
      lines.splice(start, end - start + 1);
      const next = lines.join("\n");
      activeEditor.setValue(next);
      toolbar.style.display = "none";
      currentNode = null;
    };

    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentNode && currentNode.isConnected) {
        openEditorForBlock(currentNode);
      }
    });

    delBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentNode && currentNode.isConnected) {
        deleteBlock(currentNode);
      }
    });

    const handleClickCapture = (e: MouseEvent) => {
      const block = resolveDiagramBlock(e.target);
      if (!block) return;
      e.preventDefault();
      e.stopPropagation();
      const srcPre = block.querySelector(
        ".vditor-wysiwyg__pre",
      ) as HTMLElement | null;
      const prevPre = block.querySelector(
        ".vditor-wysiwyg__preview",
      ) as HTMLElement | null;
      if (srcPre) srcPre.style.display = "none";
      if (prevPre) prevPre.style.display = "";
      showToolbarFor(block);
    };

    const handleDblClick = (e: MouseEvent) => {
      const block = resolveDiagramBlock(e.target);
      if (!block) return;
      e.preventDefault();
      e.stopPropagation();
      if (isLockedRef.current) return;
      openEditorForBlock(block);
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClickCapture, true);
    container.addEventListener("dblclick", handleDblClick, true);

    return () => {
      observer.disconnect();
      window.clearTimeout(delayTimer);
      window.clearTimeout(dismissTimer);
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClickCapture, true);
      container.removeEventListener("dblclick", handleDblClick, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      if (toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
    };
  }, [editorRootRef, isLocked]);
}
