import { Meta2d, isShowChild } from "@meta2d/core";
import { initializeShapeLibrary } from "../diagram/registerPens";
import { installCanvasPatches } from "./canvasPatches";

installCanvasPatches();

function preloadShapes(): void {
  if (!(window as any)._shapesReady) {
    initializeShapeLibrary();
    (window as any)._shapesReady = true;
  }
}

function makeOffscreenContainer(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;left:-20000px;top:0;width:1200px;height:800px;pointer-events:none;z-index:-1;";
  document.body.appendChild(el);
  return el;
}

function scheduleCleanup(m: Meta2d, host: HTMLDivElement): void {
  setTimeout(() => {
    m.destroy?.();
    host.remove();
  }, 100);
}

function sanitizeFontForSvg(ctx: any): void {
  // canvas2svg __parseFont regex chokes on unitless line-height (e.g. "12px/1.5 Arial").
  // Override the font accessor on the C2S instance to strip it before parsing.
  let _raw = ctx.font;
  Object.defineProperty(ctx, "font", {
    get() {
      return _raw;
    },
    set(v: string) {
      _raw =
        typeof v === "string"
          ? v.replace(
              /(\d+(?:\.\d+)?(?:px|pt|pc|em|ex|%|in|cm|mm))\s*\/\s*(\d+(?:\.\d+)?)(?=\s|$)/,
              "$1/normal",
            )
          : v;
      if (ctx.__ctx) ctx.__ctx.font = _raw;
    },
    configurable: true,
  });
}

export function generateSvgPreview(
  jsonStr: string,
  onDone: (svg: string, naturalWidth: number) => void,
) {
  const C2S = (window as any).C2S;
  if (!C2S) {
    onDone("", 400);
    return;
  }

  preloadShapes();
  const host = makeOffscreenContainer();
  const engine = new Meta2d(host, {
    background: "#ffffff",
    grid: false,
    rule: false,
  });
  engine.open(JSON.parse(jsonStr));
  engine.render(true);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      try {
        const bounds: any = engine.getRect();
        if (!bounds || !isFinite(bounds.width)) {
          onDone("", 400);
          scheduleCleanup(engine, host);
          return;
        }
        bounds.x -= 10;
        bounds.y -= 10;

        const w = Math.ceil(bounds.width + 20);
        const h = Math.ceil(bounds.height + 20);
        const ctx: any = new C2S(w, h);
        ctx.textBaseline = "middle";
        sanitizeFontForSvg(ctx);

        const store = (engine as any).store;
        const bg = store.data.background;
        if (bg) {
          ctx.save();
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }

        const items = store.data.pens;
        for (let i = 0; i < items.length; i++) {
          const pen = items[i];
          if (pen.visible === false || !isShowChild(pen, store)) continue;
          try {
            (engine as any).renderPenRaw(ctx, pen, bounds, true);
          } catch {
            /* skip broken pens */
          }
        }

        let svg: string = ctx.getSerializedSvg();
        svg = svg.replace(/--le5le--/g, "&#x");

        onDone(svg, Math.max(200, Math.ceil(bounds.width)));
        scheduleCleanup(engine, host);
      } catch {
        onDone("", 400);
        scheduleCleanup(engine, host);
      }
    }),
  );
}

export function releasePreviewResources(previewNode: HTMLElement) {
  const url = previewNode.dataset.objectUrl;
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    delete previewNode.dataset.objectUrl;
  }
}
