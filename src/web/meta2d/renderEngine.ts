import { Meta2d } from "@meta2d/core";
import { initializeShapeLibrary } from "../diagram/registerPens";

export function makeHiddenViewport(width: number, height: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "position: fixed",
    "left: -20000px",
    "top: 0",
    `width: ${width}px`,
    `height: ${height}px`,
    "pointer-events: none",
    "z-index: -1",
  ].join(";");
  document.body.appendChild(el);
  return el;
}

export function renderDiagramToImage(
  jsonStr: string,
  onDone: (blob: Blob, naturalWidth: number) => void,
) {
  const offscreenContainer = makeHiddenViewport(1200, 800);

  if (!(window as any)._shapesReady) {
    initializeShapeLibrary();
    (window as any)._shapesReady = true;
  }

  const meta2d = new Meta2d(offscreenContainer, {
    background: "#ffffff",
    grid: false,
    rule: false,
  });

  const data = JSON.parse(jsonStr);
  meta2d.open(data);

  const cleanup = () => {
    setTimeout(() => {
      meta2d.destroy?.();
      if (offscreenContainer.parentNode) {
        offscreenContainer.parentNode.removeChild(offscreenContainer);
      }
    }, 100);
  };

  meta2d.render(true);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        const rect = meta2d.getRect?.();
        const naturalWidth = Math.max(200, Math.ceil(rect?.width ?? 400));
        const outputWidth = naturalWidth * 2;
        meta2d.toPng(
          20,
          (blob) => {
            onDone(blob ?? new Blob(), naturalWidth);
            cleanup();
          },
          true,
          outputWidth,
        );
      } catch (err) {
        console.error("meta2d toPng failed:", err);
        onDone(new Blob(), 400);
        cleanup();
      }
    });
  });
}

export function discardCachedPreview(pc: HTMLElement) {
  const u = pc.dataset.diagramBlobUrl;
  if (u) {
    try {
      URL.revokeObjectURL(u);
    } catch {
      /* ignore */
    }
    delete pc.dataset.diagramBlobUrl;
  }
}
