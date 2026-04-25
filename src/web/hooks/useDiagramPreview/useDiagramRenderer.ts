import { useEffect, useRef, useCallback } from "react";
import { generateSvgPreview, releasePreviewResources } from "../../meta2d/renderEngine";
import { removeDiagramHud, sweepOrphanMdocsHuds, syncDiagramHud } from "./diagramHud";
import {
  BLOCK_SELECTOR,
  META2_SOURCE_SELECTOR,
  META2_PREVIEW_SELECTOR,
  parseDiagramPayload,
  sealMeta2PreviewCode,
} from "./diagramUtils";

/**
 * Hook for managing diagram rendering and refresh logic.
 */
export function useDiagramRenderer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  isLocked: boolean,
) {
  const renderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  /**
   * Renders or refreshes all chart blocks in the container.
   */
  const refreshChartBlocks = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const locked = isLockedRef.current;

    /* 删块过程中间态先清孤儿，避免与下面逻辑交错一帧把按钮画到正文里 */
    sweepOrphanMdocsHuds(container);

    const blocks = container.querySelectorAll(BLOCK_SELECTOR);

    for (const block of blocks) {
      const src = block.querySelector(META2_SOURCE_SELECTOR);
      const preview = block.querySelector(META2_PREVIEW_SELECTOR) as HTMLElement | null;
      const viewPre = block.querySelector<HTMLElement>(".vditor-wysiwyg__preview");

      // 仅处理 meta2/meta 块。pre/预览显隐只交给 App.css :has，勿在此设 inline，否则与 Vditor 重排/删块同一帧会闪回「源码+悬浮条进正文」。
      if (!(src instanceof HTMLElement) || !preview) {
        continue;
      }

      const payload = src.textContent?.trim() ?? "";

      // Handle empty payload
      if (!payload) {
        if (viewPre) {
          removeDiagramHud(viewPre);
        }
        if (preview.innerHTML || preview.getAttribute("data-rendered") === "true") {
          releasePreviewResources(preview);
          preview.removeAttribute("data-rendered");
          delete preview.dataset.chartHash;
          preview.textContent = "";
        }
        continue;
      }

      // Skip if already rendered with same content (still sync HUD, e.g. isLocked just changed)
      if (preview.getAttribute("data-rendered") === "true" && preview.dataset.chartHash === payload) {
        if (viewPre) {
          sealMeta2PreviewCode(preview);
          syncDiagramHud(viewPre, locked);
        }
        continue;
      }

      // Parse and validate payload
      const parseResult = parseDiagramPayload(payload);
      if (!parseResult.success) {
        if (viewPre) {
          removeDiagramHud(viewPre);
        }
        releasePreviewResources(preview);
        preview.removeAttribute("data-rendered");
        delete preview.dataset.chartHash;
        preview.textContent = parseResult.error;
        sealMeta2PreviewCode(preview);
        continue;
      }

      // Generate SVG preview
      generateSvgPreview(payload, (svg) => {
        if (!block.isConnected) return;

        const sc = block.querySelector(META2_SOURCE_SELECTOR);
        const pc = block.querySelector(META2_PREVIEW_SELECTOR) as HTMLElement | null;
        if (!sc || !pc) return;

        // Verify content hasn't changed
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
          sealMeta2PreviewCode(pc);
          markReady();
          const vp = block.querySelector<HTMLElement>(".vditor-wysiwyg__preview");
          if (vp) {
            syncDiagramHud(vp, isLockedRef.current);
          }
          if (container) {
            sweepOrphanMdocsHuds(container);
          }
          return;
        }

        releasePreviewResources(pc);
        const vp = block.querySelector<HTMLElement>(".vditor-wysiwyg__preview");
        if (vp) {
          removeDiagramHud(vp);
        }
        pc.textContent = "Diagram preview failed";
        sealMeta2PreviewCode(pc);
        markReady();
        if (container) {
          sweepOrphanMdocsHuds(container);
        }
      });
    }
    /* 删块/重排后，孤儿 HUD 可能挂在错位的 preview 上，导致上块条脱落、下段出现多枚按钮。 */
    sweepOrphanMdocsHuds(container);
  }, [containerRef]);

  /**
   * Queues a refresh with debouncing.
   */
  const queueRefresh = useCallback(() => {
    if (renderRef.current) {
      clearTimeout(renderRef.current);
    }
    renderRef.current = setTimeout(refreshChartBlocks, 250);
  }, [refreshChartBlocks]);

  // Initial render and cleanup
  useEffect(() => {
    refreshChartBlocks();

    return () => {
      if (renderRef.current) {
        clearTimeout(renderRef.current);
      }
    };
  }, [refreshChartBlocks]);

  useEffect(() => {
    queueRefresh();
  }, [isLocked, queueRefresh]);

  return { queueRefresh, refreshChartBlocks };
}
