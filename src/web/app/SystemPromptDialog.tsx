/**
 * 系统提示词诊断弹框：按段展示 system prompt 的体量与占比，并可查看/复制全文。
 * 数据来自 GET /api/agent/system-prompt（与真实 run 同一套 buildSystemPrompt）。
 *
 * 两个基准别混：
 * - 条形长度 = 该段在系统提示词内部的构成占比（看完知道哪段最胖）
 * - 右侧百分比 = 该段占模型上下文窗口的比例（看完知道真实体量）
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, X } from "lucide-react";

import { useI18n } from "../i18n";
import {
  fetchAgentSystemPromptApi,
  type AgentSystemPromptPayload,
} from "../services/endpoints";

const SECTION_COLORS: Record<string, string> = {
  base: "#2f6f4e",
  "ui-context": "#4f7fb8",
  soul: "#b8802a",
  "skill-meta": "#7a5fb0",
  mcp: "#3f8f7d",
  pipeline: "#b05555",
  "pipeline-yaml": "#8a6b3f",
};

function colorFor(id: string): string {
  return SECTION_COLORS[id] ?? "#6b7280";
}

/** 0.002% 显示成 "<0.01%"，避免一堆 0.00% 看着像没数据 */
function formatPercent(value: number): string {
  if (value <= 0) return "0%";
  if (value < 0.01) return "<0.01%";
  return `${value}%`;
}

export function SystemPromptDialog(props: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<AgentSystemPromptPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAgentSystemPromptApi("normal")
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  const copyPrompt = useCallback(async () => {
    if (!data?.prompt) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败，全文仍可手动选中复制
    }
  }, [data?.prompt]);

  if (!props.open) return null;

  const windowSize = data?.window ?? 0;
  const knownWindow = windowSize > 0;

  // 挂在 body：shell / 阅读模式可能带 transform，fixed 会因此错位。
  return createPortal(
    <div
      className="mdocs-prompt-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div
        className="mdocs-prompt-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("agentPromptTitle")}
      >
        <header className="mdocs-prompt-dialog-head">
          <div>
            <h2 className="mdocs-prompt-dialog-title">{t("agentPromptTitle")}</h2>
            <p className="mdocs-prompt-dialog-subtitle">{t("agentPromptSubtitle")}</p>
          </div>
          <button
            type="button"
            className="mdocs-prompt-dialog-close"
            onClick={props.onClose}
            aria-label={t("close")}
          >
            <X size={16} />
          </button>
        </header>

        {loading ? <p className="mdocs-prompt-dialog-hint">{t("agentPromptLoading")}</p> : null}
        {error ? (
          <p className="mdocs-prompt-dialog-error">
            {t("agentPromptError")}：{error}
          </p>
        ) : null}

        {data ? (
          <>
            <div className="mdocs-prompt-total">
              <span className="mdocs-prompt-total-strong">
                ~{data.total.tokens.toLocaleString()} {t("agentPromptTokens")}
              </span>
              <span className="mdocs-prompt-total-strong">
                {knownWindow
                  ? `${t("agentPromptOfWindow")} ${formatPercent(data.total.windowPercent)}`
                  : t("agentPromptWindowUnknown")}
              </span>
              <span>
                {t("agentPromptWindow")}{" "}
                {knownWindow ? windowSize.toLocaleString() : "—"} {t("agentPromptTokens")}
              </span>
              <span>
                {data.total.chars.toLocaleString()} {t("agentPromptChars")}
              </span>
              <span>
                {data.total.sections} {t("agentPromptSections")}
              </span>
            </div>

            <div className="mdocs-prompt-rows">
              {data.sections.map((section) => (
                <div key={section.id} className="mdocs-prompt-row">
                  <div className="mdocs-prompt-row-head">
                    <span className="mdocs-prompt-row-label">{section.label}</span>
                    <span className="mdocs-prompt-row-num">
                      ~{section.tokens.toLocaleString()} {t("agentPromptTokens")}
                    </span>
                    <span className="mdocs-prompt-row-pct">
                      {knownWindow ? formatPercent(section.windowPercent) : formatPercent(section.sharePercent)}
                    </span>
                  </div>
                  <div className="mdocs-prompt-bar">
                    <span
                      style={{
                        width: `${Math.max(section.sharePercent, 0.5)}%`,
                        background: colorFor(section.id),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="mdocs-prompt-legend">{t("agentPromptBarHint")}</p>

            {data.notes.length > 0 ? (
              <ul className="mdocs-prompt-notes">
                {data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}

            <div className="mdocs-prompt-full-head">
              <span>{t("agentPromptFull")}</span>
              <button type="button" className="mdocs-prompt-copy" onClick={() => void copyPrompt()}>
                <Copy size={13} />
                {copied ? t("agentPromptCopied") : t("agentPromptCopy")}
              </button>
            </div>
            <pre className="mdocs-prompt-full">{data.prompt}</pre>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
