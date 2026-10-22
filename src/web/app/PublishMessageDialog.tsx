/**
 * 手动发布前的说明弹框：可选填写 message，可 AI 根据 diff 生成。
 */
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { ApiRequestError } from "../services/client";
import { suggestCommitMessageApi } from "../services/endpoints";
import { PUBLISH_MESSAGE_MAX_LENGTH } from "../../shared/publish-meta";

export type PublishMessageDialogProps = {
  open: boolean;
  documentId: string;
  /** 待发正文（供 AI suggest） */
  content: string;
  contentFormat?: "markdown" | "lexical";
  onConfirm: (message: string) => void;
  onCancel: () => void;
};

export function PublishMessageDialog(props: PublishMessageDialogProps) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setMessage("");
    setError(null);
    setSuggestBusy(false);
  }, [props.open, props.documentId]);

  if (!props.open) return null;

  async function handleSuggest(): Promise<void> {
    setSuggestBusy(true);
    setError(null);
    try {
      const data = await suggestCommitMessageApi(props.documentId, {
        content: props.content,
        contentFormat: props.contentFormat ?? "lexical",
      });
      setMessage(data.message.slice(0, PUBLISH_MESSAGE_MAX_LENGTH));
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

  return (
    <div className="mdocs-dialog-backdrop" role="presentation" onClick={props.onCancel}>
      <div
        className="mdocs-dialog card mdocs-publish-message-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdocs-publish-message-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 id="mdocs-publish-message-title">{t("publishMessageTitle")}</h1>
        <p className="muted mdocs-dialog-hint">{t("publishMessageHint")}</p>
        <label className="mdocs-dialog-label">
          <span className="muted">{t("publishMessageLabel")}</span>
          <textarea
            className="mdocs-publish-message-input"
            rows={3}
            maxLength={PUBLISH_MESSAGE_MAX_LENGTH}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("publishMessagePlaceholder")}
            autoFocus
          />
        </label>
        {error ? (
          <p className="mdocs-dialog-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mdocs-dialog-actions mdocs-publish-message-actions">
          <button
            type="button"
            className="secondary"
            disabled={suggestBusy}
            onClick={() => void handleSuggest()}
          >
            {suggestBusy ? "…" : t("publishMessageSuggestAi")}
          </button>
          <span className="mdocs-publish-message-actions-spacer" />
          <button type="button" className="secondary" onClick={props.onCancel} disabled={suggestBusy}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={suggestBusy}
            onClick={() => props.onConfirm(message.trim())}
          >
            {t("publish")}
          </button>
        </div>
      </div>
    </div>
  );
}
