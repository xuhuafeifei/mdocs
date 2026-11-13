/**
 * 上下文诊断弹框：系统提示词 + 工具定义 + 会话历史（与圆环同源），可点开看正文。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, X } from "lucide-react";

import { useI18n } from "../i18n";
import {
  fetchAgentSystemPromptApi,
  type AgentContextBucketId,
  type AgentSystemPromptPayload,
} from "../services/endpoints";
import { copyTextToClipboard } from "./copyText";

const BUCKET_COLORS: Record<AgentContextBucketId, string> = {
  system: "#2f6f4e",
  tools: "#4f7fb8",
  history: "#b8802a",
};

function formatPercent(value: number): string {
  if (value <= 0) return "0%";
  if (value < 0.01) return "<0.01%";
  return `${value}%`;
}

export type SystemPromptDialogQuery = {
  mode?: "normal" | "coding";
  sessionId?: string | null;
  domainId?: string | null;
  documentId?: string | null;
};

export function SystemPromptDialog(props: {
  open: boolean;
  onClose: () => void;
  query?: SystemPromptDialogQuery;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<AgentSystemPromptPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bucket, setBucket] = useState<AgentContextBucketId>("history");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAgentSystemPromptApi({
      mode: props.query?.mode ?? "normal",
      sessionId: props.query?.sessionId,
      domainId: props.query?.domainId,
      documentId: props.query?.documentId,
    })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        const preferred: AgentContextBucketId =
          payload.buckets.find((b) => b.id === "history" && b.tokens > 0)?.id ??
          payload.buckets.find((b) => b.tokens > 0)?.id ??
          "system";
        setBucket(preferred);
        const first = payload.items.find((it) => it.bucket === preferred);
        setSelectedId(first?.id ?? payload.items[0]?.id ?? null);
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
  }, [
    props.open,
    props.query?.mode,
    props.query?.sessionId,
    props.query?.domainId,
    props.query?.documentId,
  ]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  const bucketItems = useMemo(
    () => (data?.items ?? []).filter((it) => it.bucket === bucket),
    [data?.items, bucket],
  );

  const selected = useMemo(
    () => (data?.items ?? []).find((it) => it.id === selectedId) ?? null,
    [data?.items, selectedId],
  );

  useEffect(() => {
    if (!data) return;
    if (selected && selected.bucket === bucket) return;
    setSelectedId(bucketItems[0]?.id ?? null);
  }, [bucket, bucketItems, data, selected]);

  const copySelected = useCallback(async () => {
    const text = selected?.content ?? data?.prompt;
    if (!text) return;
    try {
      const ok = await copyTextToClipboard(text);
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败
    }
  }, [selected?.content, data?.prompt]);

  if (!props.open) return null;

  const windowSize = data?.window ?? 0;
  const knownWindow = windowSize > 0;

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
          <h2 className="mdocs-prompt-dialog-title">{t("agentPromptTitle")}</h2>
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
                ~{(data.used ?? data.total.tokens).toLocaleString()} /{" "}
                {(data.limit ?? data.window).toLocaleString()} {t("agentPromptTokens")}
              </span>
              <span className="mdocs-prompt-total-strong">
                {knownWindow
                  ? `${t("agentPromptOfWindow")} ${formatPercent(
                      pctOf(data.used ?? data.total.tokens, data.limit || data.window),
                    )}`
                  : t("agentPromptWindowUnknown")}
              </span>
              {data.sessionId ? (
                <span>
                  {t("agentPromptSession")} {data.sessionId.slice(0, 8)}…
                </span>
              ) : null}
            </div>

            <div className="mdocs-prompt-buckets" role="tablist" aria-label={t("agentPromptBuckets")}>
              {data.buckets.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={bucket === b.id}
                  className={
                    "mdocs-prompt-bucket" + (bucket === b.id ? " is-active" : "")
                  }
                  onClick={() => setBucket(b.id)}
                >
                  <span className="mdocs-prompt-bucket-label">{b.label}</span>
                  <span className="mdocs-prompt-bucket-meta">
                    ~{b.tokens.toLocaleString()} · {formatPercent(b.shareOfUsedPercent)}
                  </span>
                  <span className="mdocs-prompt-bar mdocs-prompt-bucket-bar">
                    <span
                      style={{
                        width: `${Math.max(b.shareOfUsedPercent, b.tokens > 0 ? 0.5 : 0)}%`,
                        background: BUCKET_COLORS[b.id],
                      }}
                    />
                  </span>
                </button>
              ))}
            </div>

            <div className="mdocs-prompt-split">
              <div className="mdocs-prompt-rows" role="listbox" aria-label={t("agentPromptItems")}>
                {bucketItems.length === 0 ? (
                  <p className="mdocs-prompt-dialog-hint">{t("agentPromptEmptyBucket")}</p>
                ) : (
                  bucketItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={selectedId === item.id}
                      className={
                        "mdocs-prompt-item" + (selectedId === item.id ? " is-active" : "")
                      }
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="mdocs-prompt-row-head">
                        <span className="mdocs-prompt-row-label">{item.label}</span>
                        <span className="mdocs-prompt-row-num">
                          ~{item.tokens.toLocaleString()}
                        </span>
                        <span className="mdocs-prompt-row-pct">
                          {knownWindow
                            ? formatPercent(item.windowPercent)
                            : ""}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="mdocs-prompt-detail">
                <div className="mdocs-prompt-full-head">
                  <span>{selected?.label ?? t("agentPromptFull")}</span>
                  <button
                    type="button"
                    className="mdocs-prompt-copy"
                    onClick={() => void copySelected()}
                    disabled={!selected?.content && !data.prompt}
                  >
                    <Copy size={13} />
                    {copied ? t("agentPromptCopied") : t("agentPromptCopy")}
                  </button>
                </div>
                <pre className="mdocs-prompt-full">
                  {selected?.content || data.prompt || ""}
                </pre>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function pctOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 10000) / 100;
}
