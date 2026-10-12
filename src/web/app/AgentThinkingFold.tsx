import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

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

/** 智能助手与帮写共用的思考折叠条 */
export function AgentThinkingFold(props: {
  block: ThinkingTiming;
  live: boolean;
  now: number;
}) {
  const { block, live, now } = props;
  if (!block.text) return null;
  const sec = thoughtSeconds(block, now);
  const label =
    sec != null ? (live ? `思考中 ${sec}s` : `思考 ${sec}s`) : "思考";
  return (
    <details className="mdocs-agent-panel-think-fold">
      <summary>
        <span className={"mdocs-agent-think-label" + (live ? " live" : "")}>{label}</span>
        <ChevronRight size={14} strokeWidth={1.8} className="mdocs-agent-think-chevron" />
      </summary>
      <pre className="mdocs-agent-panel-think-body">{block.text}</pre>
    </details>
  );
}
