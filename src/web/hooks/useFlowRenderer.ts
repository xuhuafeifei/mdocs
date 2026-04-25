/* Ported from markdown-docs: frontend/src/hooks/useFlowRenderer.ts (import path + TS fixes). */
import { useEffect, useRef } from "react";
import { Meta2d } from "@meta2d/core";
import { registerAllPens } from "../diagram/registerPens";
// canvas2svg 副作用 import：把 C2S 挂到 window 上，meta2d 官方 demo 就靠这个
// 许可：MIT (Copyright (c) 2014 Gliffy Inc.)
import "canvas2svg";

// canvas2svg 没有实现 CanvasRenderingContext2D.ellipse，
// 但 meta2d 的 circle / ellipse pen 会调它，不补就会 TypeError: n.ellipse is not a function。
// 用 4 段三次贝塞尔近似椭圆（与浏览器早期 polyfill 同款），一次性挂到 C2S.prototype。
(function patchC2SEllipse() {
  const C2S = (window as any).C2S;
  if (!C2S || C2S.prototype.ellipse) return;
  C2S.prototype.ellipse = function (
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    anticlockwise?: boolean,
  ) {
    // 归一化角度到 [0, 2π)
    const TAU = Math.PI * 2;
    let s = startAngle;
    let e = endAngle;
    if (!anticlockwise && e - s >= TAU) {
      e = s + TAU;
    } else if (anticlockwise && s - e >= TAU) {
      e = s - TAU;
    } else if (!anticlockwise && s > e) {
      e = s + (TAU - ((s - e) % TAU));
    } else if (anticlockwise && s < e) {
      e = s - (TAU - ((e - s) % TAU));
    }

    // 以单位圆参数化，再做旋转+缩放映射到椭圆上
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const pointAt = (t: number): [number, number] => {
      const cx = Math.cos(t);
      const sy = Math.sin(t);
      const px = rx * cx;
      const py = ry * sy;
      return [x + px * cos - py * sin, y + px * sin + py * cos];
    };

    const [sx, syPt] = pointAt(s);
    this.moveTo(sx, syPt);

    // 每段最多 π/2，保证贝塞尔近似精度
    const totalDelta = e - s;
    const segCount = Math.max(1, Math.ceil(Math.abs(totalDelta) / (Math.PI / 2)));
    const segDelta = totalDelta / segCount;

    for (let i = 0; i < segCount; i++) {
      const t1 = s + i * segDelta;
      const t2 = t1 + segDelta;
      // 单位圆上 t1→t2 弧的控制点系数
      const alpha =
        (4 / 3) * Math.tan((t2 - t1) / 4);

      const [p1x, p1y] = pointAt(t1);
      const [p2x, p2y] = pointAt(t2);

      // 单位圆在 t 处的切向量 (-sin t, cos t)，映射到椭圆同样要乘 rx/ry 再旋转
      const tan1x = -Math.sin(t1) * rx;
      const tan1y = Math.cos(t1) * ry;
      const tan2x = -Math.sin(t2) * rx;
      const tan2y = Math.cos(t2) * ry;

      const c1x = p1x + alpha * (tan1x * cos - tan1y * sin);
      const c1y = p1y + alpha * (tan1x * sin + tan1y * cos);
      const c2x = p2x - alpha * (tan2x * cos - tan2y * sin);
      const c2y = p2y - alpha * (tan2x * sin + tan2y * cos);

      this.bezierCurveTo(c1x, c1y, c2x, c2y, p2x, p2y);
    }
  };
})();

// canvas2svg 未实现 setLineDash / lineDashOffset，meta2d 画箭头（renderToArrow）会调 setLineDash → 报错。
// 补全 API，并在 stroke 应用样式后写入 SVG 的 stroke-dasharray / stroke-dashoffset。
(function patchC2SLineDash() {
  const C2S = (window as any).C2S;
  if (!C2S?.prototype || C2S.prototype.setLineDash) return;

  C2S.prototype.setLineDash = function (segments: number[] | undefined) {
    this.lineDash =
      Array.isArray(segments) && segments.length > 0 ? segments : [];
    if (this.__ctx && typeof this.__ctx.setLineDash === "function") {
      this.__ctx.setLineDash(this.lineDash);
    }
  };

  C2S.prototype.getLineDash = function (): number[] {
    return Array.isArray(this.lineDash) ? [...this.lineDash] : [];
  };

  if (!Object.prototype.hasOwnProperty.call(C2S.prototype, "lineDashOffset")) {
    Object.defineProperty(C2S.prototype, "lineDashOffset", {
      get(this: any) {
        return this._lineDashOffset ?? 0;
      },
      set(this: any, v: number) {
        this._lineDashOffset = Number(v) || 0;
        if (this.__ctx && "lineDashOffset" in this.__ctx) {
          (this.__ctx as CanvasRenderingContext2D).lineDashOffset =
            this._lineDashOffset;
        }
      },
      configurable: true,
    });
  }

  const orig = C2S.prototype.__applyStyleToCurrentElement;
  if (typeof orig !== "function") return;

  C2S.prototype.__applyStyleToCurrentElement = function (
    this: any,
    type: string,
  ) {
    orig.call(this, type);
    const el = this.__currentElement;
    if (type !== "stroke" || !el?.setAttribute) return;
    const dash: number[] = this.lineDash;
    if (dash && dash.length > 0) {
      el.setAttribute("stroke-dasharray", dash.join(" "));
      const off = this._lineDashOffset ?? 0;
      if (off !== 0) {
        el.setAttribute("stroke-dashoffset", String(off));
      } else {
        el.removeAttribute("stroke-dashoffset");
      }
    } else {
      el.removeAttribute("stroke-dasharray");
      el.removeAttribute("stroke-dashoffset");
    }
  };
})();

/**
 * 创建一个"真实可见但在视口外"的离屏容器。
 *
 * 为什么不用 visibility:hidden：meta2d 内部有些计算依赖容器的 getBoundingClientRect
 * 返回有效尺寸，visibility:hidden 在某些浏览器下会影响子元素的 layout/paint 时机，
 * 导致 pen.calculative 的派生属性（textLines、background 等）填不全。
 * 用 left:-20000px 把它推到视口外，仍保持 display:block + 有尺寸，渲染管线完整。
 */
function createOffscreenContainer(
  width: number,
  height: number,
): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed;
    left: -20000px;
    top: 0;
    width: ${width}px;
    height: ${height}px;
    pointer-events: none;
    z-index: -1;
  `;
  document.body.appendChild(el);
  return el;
}

/**
 * 把 meta2d 数据渲染为 SVG 字符串。
 *
 * 完全照抄 meta2d 官方 diagram-editor 的 downloadSvg 实现
 * (examples/diagram-editor-vue3/src/components/Header.vue)，差别只有：
 * 1. 不触发浏览器下载，直接回调 svg 字符串
 * 2. 为每个代码块临时 new 一个 meta2d 实例到离屏可见容器，跑完整渲染管线
 *    让 pen.calculative 的派生属性（textLines/background/fill 等）填齐，
 *    否则 renderPenRaw 会产出没文字、空心形状的 SVG
 *
 * 关键：容器必须"真实可见"（不能 visibility:hidden / display:none），
 * 否则派生属性不会被计算完。
 */
function runMeta2dToSvg(
  flowJsonStr: string,
  onDone: (svg: string, naturalWidth: number) => void,
) {
  const C2S = (window as any).C2S;
  if (!C2S) {
    console.error("canvas2svg not loaded, window.C2S missing");
    onDone("", 400);
    return;
  }

  const offscreenContainer = createOffscreenContainer(1200, 800);

  if (!(window as any)._pensRegistered) {
    registerAllPens();
    (window as any)._pensRegistered = true;
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

/** 走真 Canvas 导出 PNG（不经 canvas2svg），供 SVG 失败时降级预览 */
function runMeta2dToPng(
  flowJsonStr: string,
  onDone: (blob: Blob, naturalWidth: number) => void,
) {
  const offscreenContainer = createOffscreenContainer(1200, 800);

  if (!(window as any)._pensRegistered) {
    registerAllPens();
    (window as any)._pensRegistered = true;
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

function revokePreviewBlobUrl(pc: HTMLElement) {
  const u = pc.dataset.meta2BlobUrl;
  if (u) {
    try {
      URL.revokeObjectURL(u);
    } catch {
      /* ignore */
    }
    delete pc.dataset.meta2BlobUrl;
  }
}

/** 源码为 ```meta2 或简写 ```meta，Vditor 高亮类名为 language-meta2 / language-meta */
const SEL_PRE_CODE_FLOW =
  ".vditor-wysiwyg__pre > code.language-meta2, .vditor-wysiwyg__pre > code.language-meta";
const SEL_PREVIEW_CODE_FLOW =
  ".vditor-wysiwyg__preview > code.language-meta2, .vditor-wysiwyg__preview > code.language-meta";

const OPEN_FLOW_FENCE = /^\s*```(meta2|meta)\b/;

/** 在同一文档中流程图块的出现顺序 → 该块开 fence 行的 1-based 行号 */
function findMeta2BlockLineNumber(markdown: string, blockIndex: number): number {
  const lines = markdown.split("\n");
  let count = -1;
  for (let i = 0; i < lines.length; i++) {
    if (OPEN_FLOW_FENCE.test(lines[i] ?? "")) {
      count++;
      if (count === blockIndex) {
        return i + 1;
      }
    }
  }
  return -1;
}

/** 找到 Markdown 中第 N 个流程图代码块的 [startLine, endLine]（0-based，闭区间） */
function findMeta2BlockRange(
  markdown: string,
  blockIndex: number,
): [number, number] | null {
  const lines = markdown.split("\n");
  let count = -1;
  for (let i = 0; i < lines.length; i++) {
    if (OPEN_FLOW_FENCE.test(lines[i] ?? "")) {
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

/** 按 DOM 顺序返回所有流程图块（pre 内为 meta2 / meta） */
function queryAllMeta2Blocks(container: Element): Element[] {
  return Array.from(
    container.querySelectorAll(".vditor-wysiwyg__block"),
  ).filter((b) => b.querySelector(SEL_PRE_CODE_FLOW));
}

const EDIT_ICON_SVG = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.811l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064l6.286-6.287Z"/></svg>`;

const DELETE_ICON_SVG = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675a.75.75 0 1 0-1.492.15l.66 6.6A1.75 1.75 0 0 0 5.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 0 0-1.492-.149l-.66 6.6a.25.25 0 0 1-.249.225h-5.19a.25.25 0 0 1-.249-.225l-.66-6.6Z"/></svg>`;

/**
 * 与 Vditor / mermaid 一致：只往 `.vditor-wysiwyg__preview > code.language-meta2` 填 SVG；
 * 源文本只在 `.vditor-wysiwyg__pre > code.language-meta2`。双击预览打开编辑。
 */
export function useFlowRenderer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onEdit: (lineNumber: number, flowData: any) => void,
  readOnly = false,
) {
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let debounceTimer: number;

    const processFlowBlocks = () => {
      const blocks = container.querySelectorAll(".vditor-wysiwyg__block");
      for (const block of blocks) {
        const sourceCode = block.querySelector(
          SEL_PRE_CODE_FLOW,
        );
        const previewCode = block.querySelector(
          SEL_PREVIEW_CODE_FLOW,
        ) as HTMLElement | null;

        if (!(sourceCode instanceof HTMLElement) || !previewCode) continue;

        const jsonStr = sourceCode.textContent?.trim() ?? "";

        if (!jsonStr) {
          if (
            previewCode.innerHTML ||
            previewCode.getAttribute("data-processed") === "true"
          ) {
            revokePreviewBlobUrl(previewCode);
            previewCode.removeAttribute("data-processed");
            delete previewCode.dataset.meta2Src;
            delete previewCode.dataset.meta2RenderMode;
            previewCode.textContent = "";
          }
          continue;
        }

        if (
          previewCode.getAttribute("data-processed") === "true" &&
          previewCode.dataset.meta2Src === jsonStr
        ) {
          continue;
        }

        try {
          JSON.parse(jsonStr);
        } catch {
          revokePreviewBlobUrl(previewCode);
          previewCode.removeAttribute("data-processed");
          delete previewCode.dataset.meta2Src;
          delete previewCode.dataset.meta2RenderMode;
          previewCode.textContent = "无效的 meta2 JSON";
          continue;
        }

        runMeta2dToSvg(jsonStr, (svg) => {
          if (!block.isConnected) return;

          const sc = block.querySelector(
            SEL_PRE_CODE_FLOW,
          );
          const pc = block.querySelector(
            SEL_PREVIEW_CODE_FLOW,
          ) as HTMLElement | null;
          if (!sc || !pc) return;

          const current = sc.textContent?.trim() ?? "";
          if (current !== jsonStr) return;

          const finishSvg = () => {
            revokePreviewBlobUrl(pc);
            delete pc.dataset.meta2RenderMode;
            pc.setAttribute("data-processed", "true");
            pc.dataset.meta2Src = jsonStr;
          };

          if (svg) {
            pc.innerHTML = svg;
            const svgEl = pc.querySelector("svg");
            if (svgEl) svgEl.style.display = "block";
            finishSvg();
            return;
          }

          runMeta2dToPng(jsonStr, (blob) => {
            if (!block.isConnected) return;

            const sc2 = block.querySelector(
              SEL_PRE_CODE_FLOW,
            );
            const pc2 = block.querySelector(
              SEL_PREVIEW_CODE_FLOW,
            ) as HTMLElement | null;
            if (!sc2 || !pc2) return;
            if (sc2.textContent?.trim() !== jsonStr) return;

            revokePreviewBlobUrl(pc2);
            if (!blob || blob.size === 0) {
              delete pc2.dataset.meta2RenderMode;
              pc2.textContent = "流程图渲染失败";
              pc2.setAttribute("data-processed", "true");
              pc2.dataset.meta2Src = jsonStr;
              return;
            }

            const url = URL.createObjectURL(blob);
            pc2.dataset.meta2BlobUrl = url;
            pc2.dataset.meta2RenderMode = "png";
            pc2.innerHTML = `<img src="${url}" alt="流程图" style="display:block;max-width:100%;height:auto;" draggable="false" />`;
            pc2.setAttribute("data-processed", "true");
            pc2.dataset.meta2Src = jsonStr;
          });
        });
      }
    };

    const scheduleProcess = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(processFlowBlocks, 300);
    };

    const observer = new MutationObserver(scheduleProcess);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    processFlowBlocks();

    /** 找事件冒泡路径上对应的 meta2 block（无论命中的是预览还是源） */
    const findMeta2Block = (target: EventTarget | null): Element | null => {
      if (!(target instanceof Node)) return null;
      const el = target instanceof Element ? target : target.parentElement;
      if (!el) return null;
      const block = el.closest(".vditor-wysiwyg__block");
      if (!block || !container.contains(block)) return null;
      const hasMeta2 = block.querySelector(
        SEL_PRE_CODE_FLOW,
      );
      return hasMeta2 ? block : null;
    };

    // ============== 浮层（编辑 / 删除按钮） ==============
    // 放在 document.body 下，而不是 Vditor DOM 里：
    // - Vditor 会频繁 rebuild .vditor-wysiwyg__block，挂里面的节点会被吹掉
    // - 也避免节点意外被 getValue() 序列化进 Markdown（上一版踩过的坑）
    const overlay = document.createElement("div");
    overlay.className = "meta2-flow-overlay";
    overlay.style.cssText = [
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

    const makeBtn = (html: string, title: string): HTMLButtonElement => {
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

    const editBtn = makeBtn(EDIT_ICON_SVG, "编辑流程图");
    const delBtn = makeBtn(DELETE_ICON_SVG, "删除流程图");
    delBtn.style.color = "#c7254e";

    const btnRow = document.createElement("div");
    btnRow.style.cssText =
      "display:flex;flex-direction:row;gap:4px;justify-content:flex-end;";
    btnRow.appendChild(editBtn);
    btnRow.appendChild(delBtn);

    const hintEl = document.createElement("div");
    hintEl.className = "meta2-flow-overlay-hint";
    hintEl.style.cssText = [
      "display:none",
      "font-size:11px",
      "line-height:1.35",
      "color:#666",
      "max-width:208px",
      "text-align:right",
      "padding-top:4px",
      "margin-top:2px",
      "border-top:1px solid #e8e8e8",
    ].join(";");

    overlay.appendChild(btnRow);
    overlay.appendChild(hintEl);
    document.body.appendChild(overlay);

    let activeBlock: Element | null = null;
    let hideTimer: number | undefined;

    const positionOverlay = (block: Element) => {
      const r = block.getBoundingClientRect();
      overlay.style.display = "flex";
      const pc = block.querySelector(
        SEL_PREVIEW_CODE_FLOW,
      ) as HTMLElement | null;
      const wide = pc?.dataset.meta2RenderMode === "png";
      const OVERLAY_W = wide ? 208 : 64;
      overlay.style.top = `${Math.max(4, r.top + 6)}px`;
      overlay.style.left = `${Math.max(4, r.right - OVERLAY_W - 6)}px`;
    };

    const showOverlayFor = (block: Element) => {
      window.clearTimeout(hideTimer);
      activeBlock = block;
      btnRow.style.display = readOnlyRef.current ? "none" : "flex";
      const pc = block.querySelector(
        SEL_PREVIEW_CODE_FLOW,
      ) as HTMLElement | null;
      if (pc?.dataset.meta2RenderMode === "png") {
        hintEl.textContent = "SVG渲染失败，已降级为 PNG 预览";
        hintEl.style.display = "block";
      } else {
        hintEl.textContent = "";
        hintEl.style.display = "none";
      }
      positionOverlay(block);
    };

    const scheduleHide = () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        overlay.style.display = "none";
        activeBlock = null;
      }, 120);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const block = findMeta2Block(e.target);
      if (block) showOverlayFor(block);
    };
    const handleMouseOut = (e: MouseEvent) => {
      const block = findMeta2Block(e.target);
      if (!block) return;
      // 如果鼠标转到 overlay 上，不隐藏
      const to = e.relatedTarget as Node | null;
      if (to && overlay.contains(to)) return;
      scheduleHide();
    };

    overlay.addEventListener("mouseenter", () => {
      window.clearTimeout(hideTimer);
    });
    overlay.addEventListener("mouseleave", scheduleHide);

    // 容器/窗口滚动时跟随，或直接隐藏（隐藏更省事且用户预期）
    const onScrollOrResize = () => {
      if (activeBlock && activeBlock.isConnected) {
        positionOverlay(activeBlock);
      } else {
        overlay.style.display = "none";
      }
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    // ============== 编辑 / 删除动作 ==============
    const openEditorForBlock = (block: Element) => {
      if (readOnlyRef.current) return;
      const sourceCode = block.querySelector(
        SEL_PRE_CODE_FLOW,
      );
      const raw = sourceCode?.textContent?.trim();
      if (!raw) return;
      try {
        const flowData = JSON.parse(raw);
        const blockIndex = queryAllMeta2Blocks(container).indexOf(block);

        let targetLine = -1;
        const vditorInstance = window.vditorInstance;
        if (
          vditorInstance &&
          typeof vditorInstance.getValue === "function" &&
          blockIndex >= 0
        ) {
          const md = vditorInstance.getValue();
          targetLine = findMeta2BlockLineNumber(md, blockIndex);
        }
        onEditRef.current(targetLine, flowData);
      } catch (err) {
        console.error("Failed to open flow editor:", err);
      }
    };

    const deleteBlock = (block: Element) => {
      if (readOnlyRef.current) return;
      const vditorInstance = window.vditorInstance;
      if (!vditorInstance || typeof vditorInstance.getValue !== "function") {
        return;
      }
      if (typeof vditorInstance.setValue !== "function") {
        console.warn("vditor setValue unavailable, cannot delete meta2 block");
        return;
      }
      const blockIndex = queryAllMeta2Blocks(container).indexOf(block);
      if (blockIndex < 0) return;

      // eslint-disable-next-line no-alert
      const ok = window.confirm("确定删除此流程图吗？此操作不可撤销。");
      if (!ok) return;

      const md = vditorInstance.getValue();
      const range = findMeta2BlockRange(md, blockIndex);
      if (!range) return;
      const [start, end] = range;
      const lines = md.split("\n");
      // 删 [start..end]；若紧邻的前后各有一个空行，删除后留一个空行即可，
      // 不额外处理——多一个空行不影响 Markdown 语义。
      lines.splice(start, end - start + 1);
      const next = lines.join("\n");
      vditorInstance.setValue(next);
      overlay.style.display = "none";
      activeBlock = null;
    };

    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeBlock && activeBlock.isConnected) {
        openEditorForBlock(activeBlock);
      }
    });

    delBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeBlock && activeBlock.isConnected) {
        deleteBlock(activeBlock);
      }
    });

    // ============== 点击 / 双击 ==============
    /** 单击拦截：Vditor 默认会把光标送进源 pre、隐藏预览 pre，导致用户看到 json。
     *  meta2 块里我们始终只展示 SVG 预览，所以直接阻断 click 不让 Vditor 切换。 */
    const handleClickCapture = (e: MouseEvent) => {
      const block = findMeta2Block(e.target);
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
      showOverlayFor(block);
    };

    const handleDblClick = (e: MouseEvent) => {
      const block = findMeta2Block(e.target);
      if (!block) return;
      e.preventDefault();
      e.stopPropagation();
      if (readOnlyRef.current) return;
      openEditorForBlock(block);
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClickCapture, true);
    container.addEventListener("dblclick", handleDblClick, true);

    return () => {
      observer.disconnect();
      window.clearTimeout(debounceTimer);
      window.clearTimeout(hideTimer);
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClickCapture, true);
      container.removeEventListener("dblclick", handleDblClick, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
  }, [containerRef, readOnly]);
}
