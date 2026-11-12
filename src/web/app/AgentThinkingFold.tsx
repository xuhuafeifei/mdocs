import { Check, ChevronRight, CircleCheck, Copy, Sparkles, Terminal, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

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

function splitTraceDetail(detail: string | undefined): {
  hint: string;
  command: string;
  output: string;
} {
  if (!detail?.trim()) return { hint: "", command: "", output: "" };
  const nl = detail.indexOf("\n");
  const head = (nl >= 0 ? detail.slice(0, nl) : detail).trim();
  const rest = nl >= 0 ? detail.slice(nl + 1).replace(/^\n/, "") : "";
  const command = head
    .split(/\s·\s/)
    .find((part) => part.startsWith("$ "));
  if (command) return { hint: "", command, output: rest };
  // 读取这类只有一行参数时，标题留短提示，同一段参数放进展开面板
  if (!rest) return { hint: head, command: "", output: head };
  return { hint: head, command: "", output: rest };
}

function traceTitle(label: string, hint: string): string {
  if (!hint || hint === label || hint.length > 72) return label;
  return `${label} ${hint}`;
}

function commandChipText(command: string): string {
  const text = command.replace(/^\$\s*/, "").trim();
  if (text.length <= 42) return text;
  return `${text.slice(0, 42)}…`;
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

/** 智能助手与帮写共用：一行工具步骤，展开后是命令和输出 */
export function AgentTraceStep(props: {
  title: string;
  status: "preparing" | "running" | "done" | "error";
  detail?: string;
  followTail?: boolean;
  grow?: boolean;
  children?: ReactNode;
}) {
  const { title, status, detail, followTail = false, grow = false, children } = props;
  const { hint, command, output } = splitTraceDetail(detail);
  const expandable = Boolean(command || output);
  const [open, setOpen] = useState(status === "error");
  const bodyRef = useRef<HTMLPreElement>(null);
  const stickRef = useRef(true);
  const animRef = useRef(0);
  const live = status === "preparing" || status === "running";
  const rowTitle = traceTitle(title, hint);

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

  const panelLead = command || (hint && hint !== output ? hint : "");
  const copyText = [panelLead, output].filter(Boolean).join("\n");

  const summary = (
    <>
      <TraceMark status={status} />
      <span className={"mdocs-agent-trace-step-title" + (live ? " live" : "")}>
        {rowTitle}
        {command ? "：" : ""}
      </span>
      {command ? (
        <span className="mdocs-agent-trace-chip" title={command.replace(/^\$\s*/, "")}>
          <Terminal size={12} strokeWidth={1.8} />
          <span className="mdocs-agent-trace-chip-text">{commandChipText(command)}</span>
          {status === "done" ? <Check size={12} strokeWidth={2.4} className="mdocs-agent-trace-chip-ok" /> : null}
        </span>
      ) : null}
      {expandable ? (
        <ChevronRight size={14} strokeWidth={1.8} className="mdocs-agent-trace-step-chevron" />
      ) : null}
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
        <div className="mdocs-agent-trace-panel">
          {panelLead ? <pre className="mdocs-agent-trace-command">{panelLead}</pre> : null}
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
          ) : null}
          {copyText ? (
            <button
              type="button"
              className="mdocs-agent-trace-copy"
              aria-label="复制"
              onClick={() => void navigator.clipboard.writeText(copyText)}
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
