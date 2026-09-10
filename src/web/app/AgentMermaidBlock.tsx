import { Check, Code2, Copy, Network, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function isMermaidLang(className: string | undefined): boolean {
  if (!className) return false;
  return /\blanguage-mermaid\b|\bmermaid\b/i.test(className);
}

/** Extract mermaid source from react-markdown `pre` children (`code` with lang class). */
export function extractMermaidFromPre(children: ReactNode): string | null {
  const nodes = Array.isArray(children) ? children : [children];
  for (const child of nodes) {
    if (child == null || typeof child !== "object" || !("props" in child)) continue;
    const props = (child as { props?: { className?: string; children?: ReactNode } }).props;
    if (!props || !isMermaidLang(props.className)) continue;
    return nodeText(props.children).replace(/\n$/, "");
  }
  return null;
}

type ViewMode = "diagram" | "code";

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;

let mermaidInit: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidInit) {
    mermaidInit = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      });
      return mermaid;
    });
  }
  return mermaidInit;
}

function clampScale(n: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
}

function MermaidFloatViewer(props: { svg: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [props.onClose]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    setDragging(true);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setOffset({
      x: d.originX + (e.clientX - d.startX),
      y: d.originY + (e.clientY - d.startY),
    });
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    setScale((s) => clampScale(Number((s + delta).toFixed(2))));
  }

  return createPortal(
    <div
      className="mdocs-agent-mermaid-float"
      role="dialog"
      aria-modal="true"
      aria-label="Mermaid 图预览"
    >
      <button
        type="button"
        className="mdocs-agent-mermaid-float-backdrop"
        aria-label="关闭预览"
        onClick={props.onClose}
      />
      <div className="mdocs-agent-mermaid-float-chrome">
        <div className="mdocs-agent-mermaid-float-tools">
          <button
            type="button"
            className="mdocs-agent-mermaid-float-btn"
            onClick={() => setScale((s) => clampScale(Number((s - SCALE_STEP).toFixed(2))))}
            title="缩小"
            aria-label="缩小"
          >
            <ZoomOut size={16} aria-hidden />
          </button>
          <span className="mdocs-agent-mermaid-float-scale">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="mdocs-agent-mermaid-float-btn"
            onClick={() => setScale((s) => clampScale(Number((s + SCALE_STEP).toFixed(2))))}
            title="放大"
            aria-label="放大"
          >
            <ZoomIn size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="mdocs-agent-mermaid-float-btn"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            title="重置"
          >
            重置
          </button>
          <button
            type="button"
            className="mdocs-agent-mermaid-float-btn"
            onClick={props.onClose}
            title="关闭"
            aria-label="关闭"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div
          className={
            dragging
              ? "mdocs-agent-mermaid-float-stage is-dragging"
              : "mdocs-agent-mermaid-float-stage"
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
        >
          <div
            className="mdocs-agent-mermaid-float-canvas"
            style={{
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
            }}
            dangerouslySetInnerHTML={{ __html: props.svg }}
          />
        </div>
        <p className="mdocs-agent-mermaid-float-hint">拖动平移 · 滚轮缩放 · Esc 关闭</p>
      </div>
    </div>,
    document.body,
  );
}

export function AgentMermaidBlock(props: { source: string; codeChildren?: ReactNode }) {
  const reactId = useId().replace(/:/g, "");
  const [mode, setMode] = useState<ViewMode>("diagram");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [floatOpen, setFloatOpen] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const renderGenRef = useRef(0);
  const source = props.source.trim();

  useEffect(() => {
    return () => {
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (mode !== "diagram") return;
    if (!source) {
      setSvg(null);
      setError(null);
      return;
    }

    const gen = ++renderGenRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const mermaid = await loadMermaid();
          if (gen !== renderGenRef.current) return;
          const id = `mdocs-agent-mmd-${reactId}-${gen}`;
          const { svg: nextSvg } = await mermaid.render(id, source);
          if (gen !== renderGenRef.current) return;
          setSvg(nextSvg);
          setError(null);
        } catch (err) {
          if (gen !== renderGenRef.current) return;
          setSvg(null);
          setError(err instanceof Error ? err.message : "Mermaid 渲染失败");
        }
      })();
    }, 200);

    return () => {
      window.clearTimeout(timer);
      renderGenRef.current += 1;
    };
  }, [mode, source, reactId]);

  async function onCopy() {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mdocs-agent-mermaid">
      <div className="mdocs-agent-mermaid-toolbar">
        <div className="mdocs-agent-mermaid-toggle" role="group" aria-label="Mermaid 显示模式">
          <button
            type="button"
            className={
              mode === "diagram"
                ? "mdocs-agent-mermaid-toggle-btn is-active"
                : "mdocs-agent-mermaid-toggle-btn"
            }
            onClick={() => setMode("diagram")}
            aria-pressed={mode === "diagram"}
            title="图谱"
          >
            <Network size={14} aria-hidden />
            <span>图谱</span>
          </button>
          <button
            type="button"
            className={
              mode === "code"
                ? "mdocs-agent-mermaid-toggle-btn is-active"
                : "mdocs-agent-mermaid-toggle-btn"
            }
            onClick={() => setMode("code")}
            aria-pressed={mode === "code"}
            title="代码"
          >
            <Code2 size={14} aria-hidden />
            <span>代码</span>
          </button>
        </div>
        <button
          type="button"
          className="mdocs-agent-panel-md-copy mdocs-agent-mermaid-copy"
          onClick={() => void onCopy()}
          aria-label={copied ? "已复制" : "复制代码"}
          title={copied ? "已复制" : "复制"}
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        </button>
      </div>

      {mode === "diagram" ? (
        <div className="mdocs-agent-mermaid-diagram">
          {error ? (
            <div className="mdocs-agent-mermaid-error" role="alert">
              <p>无法渲染该图，可切换到代码查看源码。</p>
              <pre>{error}</pre>
            </div>
          ) : svg ? (
            <div
              className="mdocs-agent-mermaid-svg mdocs-agent-mermaid-svg-hit"
              role="button"
              tabIndex={0}
              onClick={() => setFloatOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFloatOpen(true);
                }
              }}
              title="点击放大预览"
              aria-label="点击放大预览 Mermaid 图"
            >
              <span
                className="mdocs-agent-mermaid-svg-inner"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          ) : (
            <div className="mdocs-agent-mermaid-loading">渲染中…</div>
          )}
        </div>
      ) : (
        <div className="mdocs-agent-panel-md-pre-wrap mdocs-agent-mermaid-code">
          <pre>
            {props.codeChildren ?? <code className="language-mermaid">{source}</code>}
          </pre>
        </div>
      )}

      {floatOpen && svg ? (
        <MermaidFloatViewer svg={svg} onClose={() => setFloatOpen(false)} />
      ) : null}
    </div>
  );
}
