import { useEffect, useRef, useState } from "react";
import {
  cancelAgentSkillFormApi,
  expireAgentSkillFormApi,
  submitAgentSkillFormApi,
} from "../services/endpoints";

const NAME_RE = /^[A-Za-z0-9_]+$/;

export type SkillFormCardStatus =
  | "open"
  | "submitted"
  | "cancelled"
  | "expired"
  | "failed";

export type SkillFormCardState = {
  type: "skill_form_card";
  requestId: string;
  mode: "create" | "update";
  title: string;
  currentName?: string;
  initialName: string;
  initialDescription: string;
  initialBody: string;
  expiresAt: string;
  status: SkillFormCardStatus;
  submittedName?: string;
};

/**
 * Agent create/update skill 表单卡：名称 / 简介 / 正文 + 倒计时 + 取消。
 */
export function SkillFormCardBlock(props: {
  block: SkillFormCardState;
  onResolved: (
    requestId: string,
    status: Exclude<SkillFormCardStatus, "open">,
    submittedName?: string,
  ) => void;
}) {
  const { block, onResolved } = props;
  const [name, setName] = useState(block.initialName);
  const [description, setDescription] = useState(block.initialDescription);
  const [body, setBody] = useState(block.initialBody);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
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
        void expireAgentSkillFormApi(block.requestId)
          .catch(() => undefined)
          .finally(() => {
            onResolvedRef.current(block.requestId, "expired");
          });
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [open, block.expiresAt, block.requestId]);

  async function submit() {
    if (busy || !open) return;
    const n = name.trim();
    if (!n) {
      setLocalError("名称不能为空");
      return;
    }
    if (!NAME_RE.test(n)) {
      setLocalError("名称仅允许英文、数字、下划线");
      return;
    }
    if (!body.trim()) {
      setLocalError("正文不能为空");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await submitAgentSkillFormApi(block.requestId, {
        name: n,
        description: description.trim(),
        body,
      });
      onResolved(block.requestId, "submitted", n);
    } catch {
      onResolved(block.requestId, "failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (busy || !open) return;
    setBusy(true);
    setLocalError(null);
    expiredOnceRef.current = true;
    try {
      await cancelAgentSkillFormApi(block.requestId);
      onResolved(block.requestId, "cancelled");
    } catch {
      onResolved(block.requestId, "failed");
    } finally {
      setBusy(false);
    }
  }

  const remainSec = Math.max(0, Math.ceil((remainRatio * totalMs.current) / 1000));

  return (
    <div
      className={
        "mdocs-agent-choice-card mdocs-agent-skill-form-card" +
        (open ? "" : " mdocs-agent-choice-card-done")
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
      {block.status === "submitted" ? (
        <p className="mdocs-agent-choice-result">
          已提交{block.submittedName ? `：${block.submittedName}` : ""}
        </p>
      ) : null}
      {block.status === "cancelled" ? (
        <p className="mdocs-agent-choice-result muted">已取消</p>
      ) : null}
      {block.status === "expired" ? (
        <p className="mdocs-agent-choice-result muted">已超时，表单已失效</p>
      ) : null}
      {block.status === "failed" ? (
        <p className="mdocs-agent-choice-result muted">提交失败或已失效</p>
      ) : null}
      {open ? (
        <div className="mdocs-agent-skill-form-fields">
          <label className="mdocs-agent-skill-form-field">
            <span>名称（英文数字下划线）</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="mdocs-agent-skill-form-field">
            <span>简介</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              disabled={busy}
            />
          </label>
          <label className="mdocs-agent-skill-form-field">
            <span>正文</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              disabled={busy}
            />
          </label>
          {localError ? (
            <p className="mdocs-agent-skill-form-error">{localError}</p>
          ) : null}
          <div className="mdocs-agent-skill-form-actions">
            <button
              type="button"
              className="mdocs-agent-skill-form-cancel"
              disabled={busy}
              onClick={() => void cancel()}
            >
              取消
            </button>
            <button type="button" disabled={busy} onClick={() => void submit()}>
              {busy ? "提交中…" : block.mode === "create" ? "创建" : "保存"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
