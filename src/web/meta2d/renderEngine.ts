import { Meta2d, isShowChild } from "@meta2d/core";
import { initializeShapeLibrary } from "../diagram/registerPens";
import { installCanvasPatches } from "./canvasPatches";

installCanvasPatches();

// ---------- 配置常量 ----------
const DEFAULT_PREVIEW_WIDTH = 400;
const PREVIEW_PADDING = 10;
const CLEANUP_DELAY_MILLISECONDS = 100;

// ---------- 工具函数 ----------

function preloadShapes(): void {
  if (!(window as any)._shapesReady) {
    initializeShapeLibrary();
    (window as any)._shapesReady = true;
  }
}

function makeOffscreenContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-20000px;top:0;width:1200px;height:800px;pointer-events:none;z-index:-1;";
  document.body.appendChild(container);
  return container;
}

function scheduleCleanup(callback: () => void): void {
  setTimeout(callback, CLEANUP_DELAY_MILLISECONDS);
}

/**
 * 安全销毁 Meta2d 实例并移除宿主容器
 */
function destroyEngine(
  engine: Meta2d | null,
  hostElement: HTMLDivElement | null,
): void {
  try {
    engine?.destroy?.();
  } catch {
    // 忽略销毁时的错误
  }
  try {
    hostElement?.remove();
  } catch {
    // 忽略 DOM 移除时的错误
  }
}

/**
 * canvas2svg 的 font 解析器无法处理无单位的 line-height（如 "12px/1.5 Arial"），
 * 这里将其替换为 "normal" 避免解析崩溃。
 */
function sanitizeFontForSvg(context: any): void {
  let rawFontValue = context.font;
  Object.defineProperty(context, "font", {
    get: () => rawFontValue,
    set: (value: string) => {
      rawFontValue =
        typeof value === "string"
          ? value.replace(
              /(\d+(?:\.\d+)?(?:px|pt|pc|em|ex|%|in|cm|mm))\s*\/\s*(\d+(?:\.\d+)?)(?=\s|$)/,
              "$1/normal",
            )
          : value;
      if (context.__ctx) {
        context.__ctx.font = rawFontValue;
      }
    },
    configurable: true,
  });
}

/**
 * 安全序列化 SVG，处理特殊字符
 */
function serializeSvgSafe(context: any): string {
  try {
    const svgString = context.getSerializedSvg();
    return typeof svgString === "string"
      ? svgString.replace(/--le5le--/g, "&#x")
      : "";
  } catch {
    return "";
  }
}

/**
 * 计算视图边界，添加内边距
 */
function computeBoundsWithPadding(
  engine: Meta2d,
): { x: number; y: number; width: number; height: number } | null {
  try {
    const bounds = engine.getRect();
    if (!bounds || !isFinite(bounds.width) || !isFinite(bounds.height)) {
      return null;
    }
    return {
      x: bounds.x - PREVIEW_PADDING,
      y: bounds.y - PREVIEW_PADDING,
      width: Math.ceil(bounds.width + PREVIEW_PADDING * 2),
      height: Math.ceil(bounds.height + PREVIEW_PADDING * 2),
    };
  } catch {
    return null;
  }
}

// ---------- 主要导出函数 ----------

/**
 * 将 Meta2d 图形数据渲染为 SVG 预览
 */
export function generateSvgPreview(
  jsonString: string,
  onDone: (svgString: string, naturalWidth: number) => void,
): void {
  const Canvas2SvgConstructor = (window as any).C2S;
  if (!Canvas2SvgConstructor) {
    onDone("", DEFAULT_PREVIEW_WIDTH);
    return;
  }

  preloadShapes();

  const hostElement = makeOffscreenContainer();
  let engine: Meta2d | null = null;
  let isResolved = false;

  /**
   * 确保回调只被调用一次
   */
  const resolveOnce = (svgString: string, width: number): void => {
    if (isResolved) return;
    isResolved = true;
    onDone(svgString, width);
    scheduleCleanup(() => destroyEngine(engine, hostElement));
  };

  try {
    engine = new Meta2d(hostElement, {
      background: "#ffffff",
      grid: false,
      rule: false,
    });
    engine.open(JSON.parse(jsonString));
    engine.render(true);
  } catch {
    resolveOnce("", DEFAULT_PREVIEW_WIDTH);
    return;
  }

  // 双重 requestAnimationFrame 确保渲染完成
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (!engine) {
          resolveOnce("", DEFAULT_PREVIEW_WIDTH);
          return;
        }

        const bounds = computeBoundsWithPadding(engine);
        if (!bounds) {
          resolveOnce("", DEFAULT_PREVIEW_WIDTH);
          return;
        }

        const { x, y, width, height } = bounds;

        // 创建 Canvas2SVG 上下文
        const canvasContext = new Canvas2SvgConstructor(width, height);
        canvasContext.textBaseline = "middle";
        sanitizeFontForSvg(canvasContext);

        // 绘制背景
        const backgroundColor = (engine as any).store?.data?.background;
        if (backgroundColor) {
          canvasContext.save();
          canvasContext.fillStyle = backgroundColor;
          canvasContext.fillRect(0, 0, width, height);
          canvasContext.restore();
        }

        // 渲染所有可见图元
        const pens = (engine as any).store?.data?.pens;
        if (Array.isArray(pens)) {
          for (let index = 0; index < pens.length; index++) {
            const pen = pens[index];
            if (
              pen.visible === false ||
              !isShowChild(pen, (engine as any).store)
            ) {
              continue;
            }
            try {
              (engine as any).renderPenRaw(
                canvasContext,
                pen,
                { x, y, width, height },
                true,
              );
            } catch {
              // 跳过渲染异常的图元
            }
          }
        }

        const svgOutput = serializeSvgSafe(canvasContext);
        const naturalWidth = Math.max(200, Math.ceil(bounds.width));
        resolveOnce(svgOutput, naturalWidth);
      } catch {
        resolveOnce("", DEFAULT_PREVIEW_WIDTH);
      }
    });
  });
}

/**
 * 释放预览对象 URL 资源
 */
export function releasePreviewResources(previewNode: HTMLElement): void {
  const objectUrl = previewNode?.dataset?.objectUrl;
  if (objectUrl) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // 忽略释放失败
    }
    delete previewNode.dataset.objectUrl;
  }
}
