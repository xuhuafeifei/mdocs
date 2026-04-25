import { useEffect, useRef } from "react";
import type Vditor from "vditor";
import { findMeta2BlockLineNumber, findMeta2BlockRange } from "../diagram/meta2Markdown";
import { generateSvgPreview, releasePreviewResources } from "../meta2d/renderEngine";

const META2_SOURCE =
  ".vditor-wysiwyg__pre > code.language-meta2, .vditor-wysiwyg__pre > code.language-meta";
const META2_PREVIEW =
  ".vditor-wysiwyg__preview > code.language-meta2, .vditor-wysiwyg__preview > code.language-meta";

function getVditor(): Vditor | null {
  const v = window.vditorInstance;
  if (v && typeof (v as Vditor).getValue === "function") return v as Vditor;
  return null;
}

function findChartBlocks(root: Element): Element[] {
  return Array.from(root.querySelectorAll(".vditor-wysiwyg__block")).filter(
    (b) => b.querySelector(META2_SOURCE),
  );
}

const EDIT_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.811l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064l6.286-6.287Z"/></svg>`;

const DELETE_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675a.75.75 0 1 0-1.492.15l.66 6.6A1.75 1.75 0 0 0 5.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 0 0-1.492-.149l-.66 6.6a.25.25 0 0 1-.249-.225h-5.19a.25.25 0 0 1-.249-.225l-.66-6.6Z"/></svg>`;

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
  const onActivateDiagramRef = useRef(onActivateDiagram);
  onActivateDiagramRef.current = onActivateDiagram;
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  useEffect(() => {
    const container = editorRootRef.current;
    if (!container) return;

    let refreshTimer: number;

    const refreshChartBlocks = () => {
      const blocks = container.querySelectorAll(".vditor-wysiwyg__block");
      for (const block of blocks) {
        const src = block.querySelector(META2_SOURCE);
        const preview = block.querySelector(META2_PREVIEW) as HTMLElement | null;

        const codePre = block.querySelector(".vditor-wysiwyg__pre") as HTMLElement | null;
        const viewPre = block.querySelector(".vditor-wysiwyg__preview") as HTMLElement | null;
        if (codePre) codePre.style.display = "none";
        if (viewPre) viewPre.style.display = "";

        if (!(src instanceof HTMLElement) || !preview) continue;

        const payload = src.textContent?.trim() ?? "";

        if (!payload) {
          if (preview.innerHTML || preview.getAttribute("data-rendered") === "true") {
            releasePreviewResources(preview);
            preview.removeAttribute("data-rendered");
            delete preview.dataset.chartHash;
            preview.textContent = "";
          }
          continue;
        }

        if (
          preview.getAttribute("data-rendered") === "true" &&
          preview.dataset.chartHash === payload
        ) {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          releasePreviewResources(preview);
          preview.removeAttribute("data-rendered");
          delete preview.dataset.chartHash;
          preview.textContent = "Invalid diagram JSON";
          continue;
        }
        if (!parsed || typeof parsed !== "object") {
          releasePreviewResources(preview);
          preview.removeAttribute("data-rendered");
          delete preview.dataset.chartHash;
          preview.textContent = "Invalid diagram JSON";
          continue;
        }

        generateSvgPreview(payload, (svg) => {
          if (!block.isConnected) return;

          const sc = block.querySelector(META2_SOURCE);
          const pc = block.querySelector(META2_PREVIEW) as HTMLElement | null;
          if (!sc || !pc) return;

          const now = sc.textContent?.trim() ?? "";
          if (now !== payload) return;

          const markReady = () => {
            releasePreviewResources(pc);
            pc.setAttribute("data-rendered", "true");
            pc.dataset.chartHash = payload;
          };

          if (svg) {
            pc.innerHTML = svg;
            const svgEl = pc.querySelector("svg");
            if (svgEl) svgEl.style.display = "block";
            markReady();
            return;
          }

          releasePreviewResources(pc);
          pc.textContent = "Diagram preview failed";
          markReady();
        });
      }
    };

    const queueRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refreshChartBlocks, 250);
    };

    const observer = new MutationObserver(queueRefresh);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    refreshChartBlocks();

    const identifyChartBlock = (target: EventTarget | null): Element | null => {
      if (!(target instanceof Node)) return null;
      const el = target instanceof Element ? target : target.parentElement;
      if (!el) return null;
      const block = el.closest(".vditor-wysiwyg__block");
      if (!block || !container.contains(block)) return null;
      return block.querySelector(META2_SOURCE) ? block : null;
    };

    // --- floating action bar ---
    const actionBar = document.createElement("div");
    actionBar.className = "chart-hover-actions";
    Object.assign(actionBar.style, {
      position: "fixed",
      zIndex: "1500",
      display: "none",
      flexDirection: "column",
      alignItems: "stretch",
      gap: "0",
      padding: "4px",
      background: "rgba(255,255,255,0.92)",
      border: "1px solid #d0d7de",
      borderRadius: "6px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      pointerEvents: "auto",
    });

    const makeActionBtn = (html: string, title: string): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.title = title;
      b.innerHTML = html;
      Object.assign(b.style, {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        padding: "0",
        border: "none",
        background: "transparent",
        color: "#1a4fd8",
        cursor: "pointer",
        borderRadius: "4px",
      });
      b.addEventListener("mouseenter", () => { b.style.background = "#eef3ff"; });
      b.addEventListener("mouseleave", () => { b.style.background = "transparent"; });
      return b;
    };

    const btnEdit = makeActionBtn(EDIT_ICON, "Edit diagram");
    const btnDelete = makeActionBtn(DELETE_ICON, "Delete diagram");
    btnDelete.style.color = "#c7254e";

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      flexDirection: "row",
      gap: "4px",
      justifyContent: "flex-end",
    });
    row.appendChild(btnEdit);
    row.appendChild(btnDelete);

    actionBar.appendChild(row);
    document.body.appendChild(actionBar);

    let activeBlock: Element | null = null;
    let hideTimer: number | undefined;

    const moveToolbar = (block: Element) => {
      const r = block.getBoundingClientRect();
      actionBar.style.display = "flex";
      actionBar.style.top = `${Math.max(4, r.top + 6)}px`;
      actionBar.style.left = `${Math.max(4, r.right - 70 - 6)}px`;
    };

    const activateToolbar = (block: Element) => {
      window.clearTimeout(hideTimer);
      activeBlock = block;
      row.style.display = isLockedRef.current ? "none" : "flex";
      moveToolbar(block);
    };

    const autoHideToolbar = () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        actionBar.style.display = "none";
        activeBlock = null;
      }, 120);
    };

    const onMouseOver = (e: MouseEvent) => {
      const block = identifyChartBlock(e.target);
      if (block) activateToolbar(block);
    };
    const onMouseOut = (e: MouseEvent) => {
      const block = identifyChartBlock(e.target);
      if (!block) return;
      const to = e.relatedTarget as Node | null;
      if (to && actionBar.contains(to)) return;
      autoHideToolbar();
    };

    actionBar.addEventListener("mouseenter", () => window.clearTimeout(hideTimer));
    actionBar.addEventListener("mouseleave", autoHideToolbar);

    const onViewportChange = () => {
      if (activeBlock && activeBlock.isConnected) {
        moveToolbar(activeBlock);
      } else {
        actionBar.style.display = "none";
      }
    };
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);

    const openEditorFor = (block: Element) => {
      if (isLockedRef.current) return;
      const source = block.querySelector(META2_SOURCE);
      const raw = source?.textContent?.trim();
      if (!raw) return;
      try {
        const chartData = JSON.parse(raw);
        const blockIndex = findChartBlocks(container).indexOf(block);
        let targetLine = -1;
        const editor = getVditor();
        if (editor && blockIndex >= 0) {
          targetLine = findMeta2BlockLineNumber(editor.getValue(), blockIndex);
        }
        onActivateDiagramRef.current(targetLine, chartData, blockIndex, raw);
      } catch (err) {
        console.error("Open diagram editor failed:", err);
      }
    };

    const removeChartBlock = (block: Element) => {
      if (isLockedRef.current) return;
      const editor = getVditor();
      if (!editor || typeof editor.getValue !== "function") return;
      if (typeof editor.setValue !== "function") {
        console.warn("Editor setValue unavailable, cannot remove chart block");
        return;
      }
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
      actionBar.style.display = "none";
      activeBlock = null;
    };

    btnEdit.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeBlock && activeBlock.isConnected) openEditorFor(activeBlock);
    });

    btnDelete.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeBlock && activeBlock.isConnected) removeChartBlock(activeBlock);
    });

    const onClickCapture = (e: MouseEvent) => {
      const block = identifyChartBlock(e.target);
      if (!block) return;
      e.preventDefault();
      e.stopPropagation();
      const srcNode = block.querySelector(".vditor-wysiwyg__pre") as HTMLElement | null;
      const viewNode = block.querySelector(".vditor-wysiwyg__preview") as HTMLElement | null;
      if (srcNode) srcNode.style.display = "none";
      if (viewNode) viewNode.style.display = "";
      activateToolbar(block);
    };

    container.addEventListener("mouseover", onMouseOver);
    container.addEventListener("mouseout", onMouseOut);
    container.addEventListener("click", onClickCapture, true);

    return () => {
      observer.disconnect();
      window.clearTimeout(refreshTimer);
      window.clearTimeout(hideTimer);
      container.removeEventListener("mouseover", onMouseOver);
      container.removeEventListener("mouseout", onMouseOut);
      container.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      if (actionBar.parentNode) actionBar.parentNode.removeChild(actionBar);
    };
  }, [editorRootRef, isLocked]);
}

/** Alias: same role as `markdown-docs` `useFlowRenderer` (Vditor global = `window.vditorInstance`). */
export const useFlowRenderer = useDiagramPreview;
