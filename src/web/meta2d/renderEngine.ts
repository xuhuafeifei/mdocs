import { Meta2d, isShowChild } from "@meta2d/core";
import { initializeShapeLibrary } from "../diagram/registerPens";
import { installCanvasPatches } from "./canvasPatches";

installCanvasPatches();

function ensureShapes(): void {
  if (!(window as any)._shapesReady) {
    initializeShapeLibrary();
    (window as any)._shapesReady = true;
  }
}

function hiddenHost(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:-20000px;top:0;width:1200px;height:800px;pointer-events:none;z-index:-1;";
  document.body.appendChild(el);
  return el;
}

function destroyLater(m: Meta2d, host: HTMLDivElement): void {
  setTimeout(() => { m.destroy?.(); host.remove(); }, 100);
}

function applyFontHackToInstance(ctx: any): void {
  // canvas2svg 的 __parseFont 正则不支持 "12px/1.5 Arial" 这种无单位 line-height，
  // 会在 fillText 时 crash。在实例上覆盖 font accessor，把 /1.5 替换为 /normal。
  let _fontRaw = ctx.font;
  Object.defineProperty(ctx, "font", {
    get() { return _fontRaw; },
    set(v: string) {
      _fontRaw =
        typeof v === "string"
          ? v.replace(
              /(\d+(?:\.\d+)?(?:px|pt|pc|em|ex|%|in|cm|mm))\s*\/\s*(\d+(?:\.\d+)?)(?=\s|$)/,
              "$1/normal",
            )
          : v;
      if (ctx.__ctx) ctx.__ctx.font = _fontRaw;
    },
    configurable: true,
  });
}

export function renderDiagramToSvg(
  jsonStr: string,
  onDone: (svg: string, naturalWidth: number) => void,
) {
  const C2S = (window as any).C2S;
  if (!C2S) {
    onDone("", 400);
    return;
  }

  ensureShapes();
  const host = hiddenHost();
  const m = new Meta2d(host, { background: "#ffffff", grid: false, rule: false });
  m.open(JSON.parse(jsonStr));
  m.render(true);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      const rect: any = m.getRect();
      if (!rect || !isFinite(rect.width)) {
        onDone("", 400);
        destroyLater(m, host);
        return;
      }
      rect.x -= 10;
      rect.y -= 10;

      const width = Math.ceil(rect.width + 20);
      const height = Math.ceil(rect.height + 20);
      const ctx: any = new C2S(width, height);
      ctx.textBaseline = "middle";
      applyFontHackToInstance(ctx);

      const store = (m as any).store;
      const bg = store.data.background;
      if (bg) {
        ctx.save();
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      const pens = store.data.pens;
      for (let i = 0; i < pens.length; i++) {
        const pen = pens[i];
        if (pen.visible === false || !isShowChild(pen, store)) continue;
        try {
          (m as any).renderPenRaw(ctx, pen, rect, true);
        } catch {
          /* ignore pen render error */
        }
      }

      let svg: string = ctx.getSerializedSvg();

      // Meta2d 官方 downloadSvg 会在 <defs/> 处插入 CSS；
      // 我们直接调用 canvas2svg，输出里不会有 {{bk}} / {{bkRect}} 占位符。
      // 背景色已在上面用 fillRect 绘制，这里只做防御性的 le5le 转义清理。
      svg = svg.replace(/--le5le--/g, "&#x");

      onDone(svg, Math.max(200, Math.ceil(rect.width)));
      destroyLater(m, host);
    } catch {
      onDone("", 400);
      destroyLater(m, host);
    }
  }));
}

export function renderDiagramToImage(
  jsonStr: string,
  onDone: (blob: Blob, naturalWidth: number) => void,
) {
  ensureShapes();
  const host = hiddenHost();
  const m = new Meta2d(host, { background: "#ffffff", grid: false, rule: false });
  m.open(JSON.parse(jsonStr));
  m.render(true);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      const rect = m.getRect?.();
      const naturalWidth = Math.max(200, Math.ceil(rect?.width ?? 400));
      const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      const outputWidth = Math.min(1600, naturalWidth * Math.max(2, dpr));
      m.toPng(10, (blob) => {
        onDone(blob ?? new Blob(), naturalWidth);
        destroyLater(m, host);
      }, true, outputWidth);
    } catch {
      onDone(new Blob(), 400);
      destroyLater(m, host);
    }
  }));
}

export function discardCachedPreview(pc: HTMLElement) {
  const u = pc.dataset.diagramBlobUrl;
  if (u) {
    try { URL.revokeObjectURL(u); } catch { /* ignore */ }
    delete pc.dataset.diagramBlobUrl;
  }
}
