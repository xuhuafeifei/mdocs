/**
 * Ask / 帮写共用：ask_user_choice 选择卡 UI。
 */
import { useEffect, useRef, useState } from "react";
import {
  cancelAgentChoiceApi,
  expireAgentChoiceApi,
  submitAgentChoiceApi,
} from "../services/endpoints";

export type AgentChoiceCardState = {
  type: "choice_card";
  requestId: string;
  title: string;
  options: string[];
  expiresAt: string;
  status: "open" | "selected" | "cancelled" | "expired" | "failed";
  selected?: string;
};

export function AgentChoiceCardBlock(props: {
  block: AgentChoiceCardState;
  onResolved: (
    requestId: string,
    choice: string,
    status: "selected" | "cancelled" | "expired" | "failed",
  ) => void;
}) {
  const { block, onResolved } = props;
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [remainRatio, setRemainRatio] = useState(1);
  const expiredOnceRef = useRef(false);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;
  const open = block.status === "open";
  const totalMs = useRef(0);

  useEffect(() => {
    if (!open) return;
    expiredOnceRef.current = false;
    const end = new Date(block.expiresAt).getTime();
    const start = Date.now();
    const total = Math.max(end - start, 1);
    totalMs.current = total;
    setRemainRatio(1);

    const tick = () => {
      const left = end - Date.now();
      const ratio = Math.max(0, Math.min(1, left / total));
      setRemainRatio(ratio);
      if (left <= 0 && !expiredOnceRef.current) {
        expiredOnceRef.current = true;
        void expireAgentChoiceApi(block.requestId)
          .catch(() => undefined)
          .finally(() => {
            onResolvedRef.current(block.requestId, "", "expired");
          });
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [open, block.expiresAt, block.requestId]);

  async function submit(choice: string) {
    const text = choice.trim();
    if (!text || busy || !open) return;
    setBusy(true);
    try {
      await submitAgentChoiceApi(block.requestId, text);
      onResolved(block.requestId, text, "selected");
    } catch {
      onResolved(block.requestId, text, "failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (busy || !open) return;
    setBusy(true);
    expiredOnceRef.current = true;
    try {
      await cancelAgentChoiceApi(block.requestId);
      onResolved(block.requestId, "", "cancelled");
    } catch {
      onResolved(block.requestId, "", "failed");
    } finally {
      setBusy(false);
    }
  }

  const remainSec = Math.max(0, Math.ceil((remainRatio * totalMs.current) / 1000));

  return (
    <div
      className={
        "mdocs-agent-choice-card" + (open ? "" : " mdocs-agent-choice-card-done")
      }
    >
      <div className="mdocs-agent-choice-head">
        <p className="mdocs-agent-choice-title">{block.title}</p>
        {open ? (
          <span className="mdocs-agent-choice-timer" aria-live="polite">
            {remainSec}s
          </span>
        ) : null}
      </div>
      {open ? (
        <div
          className="mdocs-agent-choice-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(remainRatio * 100)}
        >
          <div
            className="mdocs-agent-choice-progress-bar"
            style={{ transform: `scaleX(${remainRatio})` }}
          />
        </div>
      ) : null}
      {block.status === "selected" && block.selected ? (
        <p className="mdocs-agent-choice-result">已选择：{block.selected}</p>
      ) : null}
      {block.status === "cancelled" ? (
        <p className="mdocs-agent-choice-result muted">已取消</p>
      ) : null}
      {block.status === "expired" ? (
        <p className="mdocs-agent-choice-result muted">已超时，选择已失效</p>
      ) : null}
      {block.status === "failed" ? (
        <p className="mdocs-agent-choice-result muted">提交失败或已失效</p>
      ) : null}
      {open ? (
        <>
          <div className="mdocs-agent-choice-options">
            {block.options.map((opt) => (
              <button
                key={opt}
                type="button"
                className="mdocs-agent-choice-option"
                disabled={busy}
                onClick={() => void submit(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="mdocs-agent-choice-custom">
            <input
              value={custom}
              disabled={busy}
              placeholder="或输入自己的内容…"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit(custom);
                }
              }}
            />
            <button
              type="button"
              disabled={busy || !custom.trim()}
              onClick={() => void submit(custom)}
            >
              提交
            </button>
          </div>
          <div className="mdocs-agent-choice-footer">
            <button
              type="button"
              className="mdocs-agent-choice-cancel"
              disabled={busy}
              onClick={() => void cancel()}
            >
              取消
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
