/**
 * 手动发布 / 合并发布前的说明弹框：可选填写 message，可 AI 生成。
 * mode=publish → suggest-commit-message；mode=merge → suggest-merge-message。
 *
 * 必须 portal 到 document.body：窄屏 reader 壳对 `.mdocs-layout--reader` 做了
 * translate3d，会变成 fixed 的 containing block，弹层会相对「侧栏宽+一屏」居中，
 * 在可视区里偏左甚至裁切。
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n";
import { ApiRequestError } from "../services/client";
import { suggestCommitMessageApi, suggestMergeMessageApi } from "../services/endpoints";
import { PUBLISH_MESSAGE_MAX_LENGTH } from "../../shared/publish-meta";

export type PublishMessageDialogProps = {
  open: boolean;
  documentId: string;
  /** 待发正文（普通发布 AI suggest；merge 模式下作 merged 侧） */
  content: string;
  contentFormat?: "markdown" | "lexical" | "plain";
  mode?: "publish" | "merge";
  /** merge 模式 AI 入参 */
  mergeSuggest?: {
    localContent: string;
    remoteContent: string;
    mergedContent: string;
    baseContent?: string;
  };
  onConfirm: (message: string) => void;
  onCancel: () => void;
};

function preferImmediateAutofocus(): boolean {
  if (typeof window === "undefined") return true;
  // 窄屏 / 触控：立即 focus 会弹键盘压缩 visualViewport，弹层看起来「偏下」
  if (window.matchMedia("(max-width: 768px)").matches) return false;
  if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return false;
  return true;
}

export function PublishMessageDialog(props: PublishMessageDialogProps) {
  const { t } = useI18n();
  const mode = props.mode ?? "publish";
  const [message, setMessage] = useState("");
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!props.open) return;
    setMessage("");
    setError(null);
    setSuggestBusy(false);
  }, [props.open, props.documentId, mode]);

  useEffect(() => {
    if (!props.open) return;
    if (!preferImmediateAutofocus()) return;
    const el = inputRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [props.open, props.documentId, mode]);

  if (!props.open) return null;

  function confirmPublish(): void {
    if (suggestBusy) return;
    props.onConfirm(message.trim());
  }

  async function handleSuggest(): Promise<void> {
    setSuggestBusy(true);
    setError(null);
    try {
      if (mode === "merge") {
        const ms = props.mergeSuggest;
        if (!ms) {
          setError("missing merge suggest payload");
          return;
        }
        const data = await suggestMergeMessageApi(props.documentId, {
          localContent: ms.localContent,
          remoteContent: ms.remoteContent,
          mergedContent: ms.mergedContent,
          baseContent: ms.baseContent,
          contentFormat: props.contentFormat ?? "markdown",
        });
        setMessage(data.message.slice(0, PUBLISH_MESSAGE_MAX_LENGTH));
      } else {
        const data = await suggestCommitMessageApi(props.documentId, {
          content: props.content,
          contentFormat: props.contentFormat === "plain" ? "markdown" : props.contentFormat ?? "lexical",
        });
        setMessage(data.message.slice(0, PUBLISH_MESSAGE_MAX_LENGTH));
      }
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      setError(msg);
    } finally {
      setSuggestBusy(false);
    }
  }

  const title = mode === "merge" ? t("mergePublishMessageTitle") : t("publishMessageTitle");
  const hint = mode === "merge" ? t("mergePublishMessageHint") : t("publishMessageHint");
  const placeholder =
    mode === "merge" ? t("mergePublishMessagePlaceholder") : t("publishMessagePlaceholder");

  return createPortal(
    <div
      className="mdocs-dialog-backdrop mdocs-publish-message-backdrop"
      role="presentation"
      onClick={props.onCancel}
    >
      <div
        className="mdocs-dialog card mdocs-publish-message-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdocs-publish-message-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 id="mdocs-publish-message-title">{title}</h1>
        <p className="muted mdocs-dialog-hint">{hint}</p>
        <label className="mdocs-dialog-label mdocs-publish-message-field">
          <span className="mdocs-publish-message-label-row">
            <span className="muted">{t("publishMessageLabel")}</span>
            <button
              type="button"
              className="ghost mdocs-publish-message-ai"
              disabled={suggestBusy}
              onClick={(e) => {
                e.preventDefault();
                void handleSuggest();
              }}
            >
              {suggestBusy ? "…" : t("publishMessageSuggestAi")}
            </button>
          </span>
          <textarea
            ref={inputRef}
            className="mdocs-publish-message-input"
            rows={3}
            maxLength={PUBLISH_MESSAGE_MAX_LENGTH}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (e.shiftKey) return;
              e.preventDefault();
              confirmPublish();
            }}
            placeholder={placeholder}
          />
        </label>
        {error ? (
          <p className="mdocs-dialog-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mdocs-dialog-actions mdocs-publish-message-actions">
          <button type="button" className="secondary" onClick={props.onCancel} disabled={suggestBusy}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={suggestBusy}
            onClick={() => confirmPublish()}
          >
            {t("publish")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
