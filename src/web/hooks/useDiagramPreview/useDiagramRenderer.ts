import {
  BLOCK_SELECTOR,
  META2_PREVIEW_SELECTOR,
  META2_SOURCE_SELECTOR,
  parseDiagramPayload,
  sealMeta2PreviewCode,
} from "./diagramUtils";
import { removeDiagramHud, sweepOrphanMdocsHuds, syncDiagramHud } from "./diagramHud";
import { generateSvgPreview, releasePreviewResources } from "../../meta2d/renderEngine";
import { useCallback, useEffect, useRef } from "react";

export function useDiagramRenderer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  isLocked: boolean,
) {
  const lock = useRef(isLocked);
  const tmr = useRef<ReturnType<typeof setTimeout> | null>(null);
  lock.current = isLocked;

  const refreshChartBlocks = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    sweepOrphanMdocsHuds(root);
    const blocks = root.querySelectorAll(BLOCK_SELECTOR);

    for (const b of blocks) {
      const w = b.querySelector<HTMLElement>(".vditor-wysiwyg__preview");
      const p = b.querySelector(META2_PREVIEW_SELECTOR) as HTMLElement | null;
      const s = b.querySelector(META2_SOURCE_SELECTOR);

      if (!(s instanceof HTMLElement) || !p) continue;

      const raw = s.textContent?.trim() ?? "";

      if (!raw) {
        if (w) removeDiagramHud(w);
        if (p.innerHTML || p.getAttribute("data-rendered") === "true") {
          releasePreviewResources(p);
          p.removeAttribute("data-rendered");
          delete p.dataset.chartHash;
          p.textContent = "";
        }
        continue;
      }

      if (p.getAttribute("data-rendered") === "true" && p.dataset.chartHash === raw) {
        if (w) {
          sealMeta2PreviewCode(p);
          syncDiagramHud(w, lock.current);
        }
        continue;
      }

      const pr = parseDiagramPayload(raw);
      if (!pr.success) {
        if (w) removeDiagramHud(w);
        releasePreviewResources(p);
        p.removeAttribute("data-rendered");
        delete p.dataset.chartHash;
        p.textContent = pr.error;
        sealMeta2PreviewCode(p);
        continue;
      }

      generateSvgPreview(raw, (svg) => {
        if (!b.isConnected) return;

        const p2 = b.querySelector(META2_PREVIEW_SELECTOR) as HTMLElement | null;
        const s2 = b.querySelector(META2_SOURCE_SELECTOR);
        if (!s2 || !p2) return;

        if ((s2.textContent?.trim() ?? "") !== raw) return;

        const mark = () => {
          releasePreviewResources(p2);
          p2.setAttribute("data-rendered", "true");
          p2.dataset.chartHash = raw;
        };

        if (svg) {
          p2.innerHTML = svg;
          const g = p2.querySelector("svg");
          if (g) g.style.display = "block";
          sealMeta2PreviewCode(p2);
          mark();
          const vw = b.querySelector<HTMLElement>(".vditor-wysiwyg__preview");
          if (vw) syncDiagramHud(vw, lock.current);
          if (root) sweepOrphanMdocsHuds(root);
          return;
        }

        releasePreviewResources(p2);
        const vw = b.querySelector<HTMLElement>(".vditor-wysiwyg__preview");
        if (vw) removeDiagramHud(vw);
        p2.textContent = "Diagram preview failed";
        sealMeta2PreviewCode(p2);
        mark();
        if (root) sweepOrphanMdocsHuds(root);
      });
    }
    sweepOrphanMdocsHuds(root);
  }, [containerRef]);

  const queueRefresh = useCallback(() => {
    if (tmr.current) clearTimeout(tmr.current);
    tmr.current = setTimeout(refreshChartBlocks, 250);
  }, [refreshChartBlocks]);

  useEffect(() => {
    refreshChartBlocks();
    return () => {
      if (tmr.current) clearTimeout(tmr.current);
    };
  }, [refreshChartBlocks]);

  useEffect(() => {
    queueRefresh();
  }, [isLocked, queueRefresh]);

  return { refreshChartBlocks, queueRefresh };
}
