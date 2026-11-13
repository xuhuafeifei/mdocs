import { ChevronRight, CircleCheck, Copy, Sparkles, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { copyTextToClipboard } from "./copyText";

export type ThinkingTiming = {
  text: string;
  startedAt?: number;
  endedAt?: number;
};

export function useThinkClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function thoughtSeconds(block: ThinkingTiming, now: number): number | null {
  if (!block.startedAt) return null;
  const end = block.endedAt ?? now;
  return Math.max(1, Math.round((end - block.startedAt) / 1000));
}

export function sealThinking<B extends { type: string; startedAt?: number; endedAt?: number }>(
  blocks: B[],
  now = Date.now(),
): B[] {
  let changed = false;
  const next = blocks.map((b) => {
    if (b.type === "thinking" && b.startedAt && !b.endedAt) {
      changed = true;
      return { ...b, endedAt: now };
    }
    return b;
  });
  return changed ? next : blocks;
}

/** 兼容旧 detail：meta\\nbody → input/output */
function splitLegacyDetail(detail: string | undefined): {
  summary: string;
  input: string;
  output: string;
} {
  if (!detail?.trim()) return { summary: "", input: "", output: "" };
  const nl = detail.indexOf("\n");
  const head = (nl >= 0 ? detail.slice(0, nl) : detail).trim();
  const rest = nl >= 0 ? detail.slice(nl + 1).replace(/^\n/, "") : "";
  if (head.startsWith("$ ")) {
    return { summary: "", input: head, output: rest };
  }
  if (!rest) {
    // 仅一行：当作 input（参数预览）
    return { summary: head, input: head, output: "" };
  }
  return { summary: head, input: "", output: rest };
}

function clipLabel(text: string, max = 36): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** 智能助手与帮写共用：已完成的深度思考 */
export function AgentThinkingFold(props: {
  block: ThinkingTiming;
  live: boolean;
  now: number;
}) {
  const { block, live } = props;
  if (!block.text) return null;
  const label = live ? "深度思考中" : "已深度思考";
  return (
    <details className="mdocs-agent-trace-think">
      <summary>
        <Sparkles size={14} strokeWidth={1.8} className="mdocs-agent-trace-think-icon" />
        <span className={"mdocs-agent-think-label" + (live ? " live" : "")}>{label}</span>
        <ChevronRight size={14} strokeWidth={1.8} className="mdocs-agent-think-chevron" />
      </summary>
      <pre className="mdocs-agent-panel-think-body">{block.text}</pre>
    </details>
  );
}

/** 工具卡片：标题行右侧摘要/文档链；展开后上输入（浅）下输出（灰） */
export function AgentTraceStep(props: {
  title: string;
  status: "preparing" | "running" | "done" | "error";
  detail?: string;
  summary?: string;
  input?: string;
  output?: string;
  documentId?: string;
  documentTitle?: string;
  onOpenDocument?: (documentId: string) => void;
  followTail?: boolean;
  grow?: boolean;
  children?: ReactNode;
}) {
  const {
    title,
    status,
    detail,
    summary: summaryProp,
    input: inputProp,
    output: outputProp,
    documentId,
    documentTitle,
    onOpenDocument,
    followTail = false,
    grow = false,
    children,
  } = props;

  const legacy = splitLegacyDetail(detail);
  const input = (inputProp ?? "").trim() || legacy.input;
  const output = (outputProp ?? "").trim() || legacy.output;
  const summaryText =
    (summaryProp ?? "").trim() ||
    (documentTitle ?? "").trim() ||
    (legacy.summary && legacy.summary !== input ? legacy.summary : "");

  const expandable = Boolean(input || output);
  const [open, setOpen] = useState(status === "error");
  const bodyRef = useRef<HTMLPreElement>(null);
  const stickRef = useRef(true);
  const animRef = useRef(0);
  const live = status === "preparing" || status === "running";

  useLayoutEffect(() => {
    if (!open || !followTail || !output || !bodyRef.current) return;
    if (!stickRef.current) return;
    const el = bodyRef.current;
    cancelAnimationFrame(animRef.current);
    if (!grow) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    const step = () => {
      const target = el.scrollHeight - el.clientHeight;
      const delta = target - el.scrollTop;
      if (delta <= 1) {
        el.scrollTop = target;
        return;
      }
      el.scrollTop += Math.max(1.5, delta * 0.28);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [output, followTail, grow, open]);

  const copyText = [input, output].filter(Boolean).join("\n\n");
  const rightLabel = clipLabel(documentTitle || summaryText);
  const canLink = Boolean(documentId && onOpenDocument);

  const summary = (
    <>
      <TraceMark status={status} />
      <span className={"mdocs-agent-trace-step-title" + (live ? " live" : "")}>{title}</span>
      <span className="mdocs-agent-trace-step-right">
        {canLink && rightLabel ? (
          <button
            type="button"
            className="mdocs-agent-trace-doc-link"
            title={documentTitle || summaryText || documentId}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenDocument?.(documentId!);
            }}
          >
            《{rightLabel}》
          </button>
        ) : rightLabel ? (
          <span className="mdocs-agent-trace-step-summary-text" title={summaryText}>
            {rightLabel}
          </span>
        ) : null}
        {expandable ? (
          <ChevronRight size={14} strokeWidth={1.8} className="mdocs-agent-trace-step-chevron" />
        ) : null}
      </span>
    </>
  );

  if (!expandable) {
    return (
      <div className={`mdocs-agent-trace-step mdocs-agent-trace-step-${status}`}>
        <div className="mdocs-agent-trace-step-summary">{summary}</div>
        {children}
      </div>
    );
  }

  return (
    <div className={`mdocs-agent-trace-step mdocs-agent-trace-step-${status}`}>
      <details
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="mdocs-agent-trace-step-summary">{summary}</summary>
        <div className="mdocs-agent-trace-io">
          {input ? <pre className="mdocs-agent-trace-input">{input}</pre> : null}
          {output ? (
            <pre
              ref={bodyRef}
              className="mdocs-agent-trace-output"
              onScroll={() => {
                const el = bodyRef.current;
                if (!el) return;
                stickRef.current = el.scrollHeight - el.clientHeight - el.scrollTop < 28;
              }}
            >
              {output}
            </pre>
          ) : live ? (
            <pre className="mdocs-agent-trace-output muted">执行中…</pre>
          ) : null}
          {copyText ? (
            <button
              type="button"
              className="mdocs-agent-trace-copy"
              aria-label="复制"
              onClick={() => void copyTextToClipboard(copyText)}
            >
              <Copy size={13} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </details>
      {children}
    </div>
  );
}

function TraceMark(props: { status: "preparing" | "running" | "done" | "error" }) {
  if (props.status === "error") {
    return (
      <span className="mdocs-agent-trace-mark error" aria-hidden>
        <X size={11} strokeWidth={2.4} />
      </span>
    );
  }
  if (props.status === "done") {
    return <CircleCheck size={15} strokeWidth={1.9} className="mdocs-agent-trace-mark done" aria-hidden />;
  }
  return <span className="mdocs-agent-trace-mark pending" aria-hidden />;
}
