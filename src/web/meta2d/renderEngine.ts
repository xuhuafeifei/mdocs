import { Meta2d } from "@meta2d/core";
import { ensureMeta2Shapes } from "./shapeRegistry";
import { fixEllipseRendering, fixDashPatternSupport } from "./canvasPatches";

fixEllipseRendering();
fixDashPatternSupport();

let sharedHost: HTMLDivElement | null = null;
let sharedMeta2d: Meta2d | null = null;

function getSharedHost(): HTMLDivElement {
  if (sharedHost && sharedHost.isConnected) return sharedHost;
  const el = document.createElement("div");
  el.style.cssText = [
    "position: fixed",
    "left: -20000px",
    "top: -20000px",
    "width: 1200px",
    "height: 800px",
    "opacity: 0",
    "pointer-events: none",
    "z-index: -1",
  ].join(";");
  document.body.appendChild(el);
  sharedHost = el;
  return el;
}

function getSharedMeta2d(): Meta2d {
  const host = getSharedHost();
  if (sharedMeta2d) return sharedMeta2d;
  ensureMeta2Shapes();
  sharedMeta2d = new Meta2d(host, {
    background: "#ffffff",
    grid: false,
    rule: false,
  });
  return sharedMeta2d;
}

function safeReset(meta2d: Meta2d): void {
  try {
    meta2d.open({ pens: [] } as any);
  } catch {
    // ignore
  }
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

  const meta2d = getSharedMeta2d();
  safeReset(meta2d);
  meta2d.open(JSON.parse(flowJsonStr));

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

        let fontRaw = ctx.font;
        Object.defineProperty(ctx, "font", {
          get() {
            return fontRaw;
          },
          set(v: string) {
            fontRaw =
              typeof v === "string"
                ? v.replace(
                    /(\d+(?:\.\d+)?(?:px|pt|pc|em|ex|%|in|cm|mm))\s*\/\s*(\d+(?:\.\d+)?)(?=\s|$)/,
                    "$1/normal",
                  )
                : v;
            if (this.__ctx) this.__ctx.font = fontRaw;
          },
        });

        const pens = (meta2d as any).store.data.pens as any[];
        const store = (meta2d as any).store;
        for (const pen of pens) {
          if (pen.visible === false) continue;
          (meta2d as any).renderPenRaw(ctx, pen, rect);
        }

        const background = store.data.background as string | undefined;
        let svg: string = ctx.getSerializedSvg();
        svg = svg.replace("{{bk}}", "");
        svg = svg.replace(
          "{{bkRect}}",
          background
            ? `<rect x="0" y="0" width="100%" height="100%" fill="${background}"></rect>`
            : "",
        );
        svg = svg.replace(/--le5le--/g, "&#x");

        const naturalWidth = Math.max(200, Math.ceil(rect.width));
        onDone(svg, naturalWidth);
      } catch (err) {
        console.error("meta2d toSvg failed:", err);
        onDone("", 400);
      }
    });
  });
}

export function renderRasterGraphic(
  flowJsonStr: string,
  onDone: (blob: Blob, naturalWidth: number) => void,
) {
  const meta2d = getSharedMeta2d();
  safeReset(meta2d);
  meta2d.open(JSON.parse(flowJsonStr));

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
          },
          true,
          outputWidth,
        );
      } catch (err) {
        console.error("meta2d toPng failed:", err);
        onDone(new Blob(), 400);
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
