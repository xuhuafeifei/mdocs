import { Meta2d } from "@meta2d/core";
import { initializeShapeLibrary } from "../diagram/registerPens";
import { fixEllipseRendering, fixDashPatternSupport } from "./canvasPatches";

fixEllipseRendering();
fixDashPatternSupport();

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

export function renderVectorGraphic(
  flowJsonStr: string,
  onDone: (svg: string, naturalWidth: number) => void,
) {
  const C2S = (window as any).C2S;
  if (!C2S) {
    console.error("canvas2svg not loaded, window.C2S missing");
    onDone("", 400);
    return;
  }

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

  const data = JSON.parse(flowJsonStr);
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
        const rect: any = meta2d.getRect();
        rect.x -= 10;
        rect.y -= 10;
        const width = Math.ceil(rect.width + 20);
        const height = Math.ceil(rect.height + 20);

        const ctx: any = new C2S(width, height);
        ctx.textBaseline = "middle";

        let _fontRaw = ctx.font;
        Object.defineProperty(ctx, "font", {
          get() {
            return _fontRaw;
          },
          set(v: string) {
            _fontRaw =
              typeof v === "string"
                ? v.replace(
                    /(\d+(?:\.\d+)?(?:px|pt|pc|em|ex|%|in|cm|mm))\s*\/\s*(\d+(?:\.\d+)?)(?=\s|$)/,
                    "$1/normal",
                  )
                : v;
            if (this.__ctx) this.__ctx.font = _fontRaw;
          },
        });

        const pens = (meta2d as any).store.data.pens as any[];
        const store = (meta2d as any).store;
        for (const pen of pens) {
          if (pen.visible === false) continue;
          (meta2d as any).renderPenRaw(ctx, pen, rect);
        }

        let svg: string = ctx.getSerializedSvg();

        const background = store.data.background;
        if (background) {
          svg = svg.replace("{{bk}}", "");
          svg = svg.replace(
            "{{bkRect}}",
            `<rect x="0" y="0" width="100%" height="100%" fill="${background}"></rect>`,
          );
        } else {
          svg = svg.replace("{{bk}}", "");
          svg = svg.replace("{{bkRect}}", "");
        }

        svg = svg.replace(/--le5le--/g, "&#x");

        const naturalWidth = Math.max(200, Math.ceil(rect.width));
        onDone(svg, naturalWidth);
        cleanup();
      } catch (err) {
        console.error("meta2d toSvg failed:", err);
        onDone("", 400);
        cleanup();
      }
    });
  });
}

export function renderRasterGraphic(
  flowJsonStr: string,
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

  const data = JSON.parse(flowJsonStr);
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
