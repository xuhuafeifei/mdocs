import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMarkdownPlugin,
  ReactMarkmapPlugin,
  ReactMathPlugin,
  ReactMeta2dPlugin,
  ReactTablePlugin,
} from "@lobehub/editor";
import { Editor } from "@lobehub/editor/react";
import { useI18n } from "../i18n";
import { ApiRequestError } from "../services/client";
import type { DocumentDetail } from "../../shared/types/document";
import {
  getDocumentCommitApi,
  listDocumentCommitsApi,
  restoreDocumentVersionApi,
  type DocumentCommitDetail,
  type DocumentCommitSummary,
} from "../services/endpoints";

/** 与 DocumentEditor / LexicalMarkdownBridge 对齐的只读预览插件 */
const PREVIEW_PLUGINS = [
  ReactMarkdownPlugin,
  ReactListPlugin,
  ReactLinkPlugin,
  ReactImagePlugin,
  ReactCodemirrorPlugin,
  ReactHRPlugin,
  ReactTablePlugin,
  ReactMathPlugin,
  ReactMeta2dPlugin,
  ReactMarkmapPlugin,
  ReactCodePlugin,
];

const EMPTY_PARAGRAPH_LEXICAL =
  '{"root":{"direction":"ltr","format":"","indent":0,"version":1,"type":"root","children":[{"direction":"ltr","format":"","indent":0,"version":1,"textFormat":0,"textStyle":"","children":[],"type":"paragraph"}]}}';

function detectContentType(content: string): "json" | "markdown" {
  try {
    const parsed = JSON.parse(content) as { root?: { children?: unknown[] } };
    return parsed?.root?.children ? "json" : "markdown";
  } catch {
    return "markdown";
  }
}

function ensureNonEmptyLexical(content: string, contentType: "json" | "markdown"): string {
  if (!content) return contentType === "json" ? EMPTY_PARAGRAPH_LEXICAL : "";
  if (contentType !== "json") return content;
  try {
    const parsed = JSON.parse(content) as { root?: { children?: unknown[] } };
    if (parsed?.root && Array.isArray(parsed.root.children) && parsed.root.children.length === 0) {
      return EMPTY_PARAGRAPH_LEXICAL;
    }
  } catch {
    /* keep */
  }
  return content;
}

function VersionMdPreview(props: { commitId: string; content: string }) {
  const contentType = useMemo(() => detectContentType(props.content), [props.content]);
  const safe = useMemo(
    () => ensureNonEmptyLexical(props.content, contentType),
    [props.content, contentType],
  );
  return (
    <div className="mdocs-version-preview-editor">
      <Editor
        key={props.commitId}
        content={safe}
        type={contentType}
        editable={false}
        plugins={PREVIEW_PLUGINS}
        className="mdocs-document-editor-root"
      />
    </div>
  );
}

function VersionHtmlPreview(props: { content: string }) {
  return (
    <iframe
      title="html-preview"
      className="mdocs-version-preview-html"
      sandbox=""
      srcDoc={props.content}
    />
  );
}

function VersionSheetPreview(props: { content: string }) {
  const { t } = useI18n();
  let summary = t("versionHistorySheetHint");
  try {
    const parsed = JSON.parse(props.content) as {
      sheets?: Array<{ name?: string; rows?: unknown[] }>;
    };
    if (Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
      summary = parsed.sheets
        .map((s, i) => `${s.name || `Sheet${i + 1}`} (${Array.isArray(s.rows) ? s.rows.length : 0} rows)`)
        .join("\n");
    }
  } catch {
    /* keep hint */
  }
  return <pre className="mdocs-version-preview-sheet">{summary}</pre>;
}

export function VersionHistoryPanel(props: {
  documentId: string;
  /** md | html | sheet — 决定预览方式 */
  fileType?: string;
  canRestore: boolean;
  onClose: () => void;
  onRestored: (doc: DocumentDetail) => void;
}) {
  const { t } = useI18n();
  const fileType = props.fileType || "md";
  const [items, setItems] = useState<DocumentCommitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentCommitDetail | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [hideAuto, setHideAuto] = useState(() => {
    try {
      return sessionStorage.getItem("mdocs.versionHistory.hideAuto") === "1";
    } catch {
      return false;
    }
  });

  const visibleItems = useMemo(
    () => (hideAuto ? items.filter((c) => c.source !== "auto") : items),
    [items, hideAuto],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDocumentCommitsApi(props.documentId);
      setItems(data);
      const visible = hideAuto ? data.filter((c) => c.source !== "auto") : data;
      const head = visible.find((c) => c.isHead) ?? visible[0] ?? data[0];
      if (head) setSelectedId(head.commitId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [props.documentId, hideAuto]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      sessionStorage.setItem("mdocs.versionHistory.hideAuto", hideAuto ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (hideAuto && selectedId) {
      const still = items.some((c) => c.commitId === selectedId && c.source !== "auto");
      if (!still) {
        const next = items.find((c) => c.source !== "auto");
        setSelectedId(next?.commitId ?? null);
        setConfirmRestore(false);
      }
    }
  }, [hideAuto, items, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewBusy(true);
    void getDocumentCommitApi(props.documentId, selectedId)
      .then((d) => {
        if (!cancelled) setPreview(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.documentId, selectedId]);

  async function handleRestore(): Promise<void> {
    if (!selectedId || restoreBusy) return;
    setRestoreBusy(true);
    setError(null);
    try {
      const doc = await restoreDocumentVersionApi(props.documentId, selectedId);
      props.onRestored(doc);
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      setError(msg);
      setConfirmRestore(false);
    } finally {
      setRestoreBusy(false);
    }
  }

  const selected = items.find((c) => c.commitId === selectedId) ?? null;

  return (
    <div className="mdocs-dialog-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="mdocs-dialog card mdocs-version-history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdocs-version-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mdocs-version-history-head">
          <div>
            <h1 id="mdocs-version-history-title">{t("versionHistoryTitle")}</h1>
            <p className="mdocs-version-history-desc">{t("versionHistoryDesc")}</p>
            <label className="mdocs-version-history-filter muted">
              <input
                type="checkbox"
                checked={hideAuto}
                onChange={(e) => setHideAuto(e.target.checked)}
              />
              {t("versionHistoryHideAuto")}
            </label>
          </div>
          <button type="button" className="secondary" onClick={props.onClose}>
            {t("close")}
          </button>
        </header>

        {error ? (
          <p className="mdocs-dialog-error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="muted">{t("loading")}</p>
        ) : items.length === 0 ? (
          <p className="muted">{t("versionHistoryEmpty")}</p>
        ) : visibleItems.length === 0 ? (
          <p className="muted">{t("versionHistoryEmpty")}</p>
        ) : (
          <div className="mdocs-version-history-body">
            <ul className="mdocs-version-history-list">
              {visibleItems.map((c) => (
                <li key={c.commitId}>
                  <button
                    type="button"
                    className={
                      "mdocs-version-history-item" +
                      (c.commitId === selectedId ? " is-active" : "")
                    }
                    onClick={() => {
                      setConfirmRestore(false);
                      setSelectedId(c.commitId);
                    }}
                  >
                    <span className="mdocs-version-history-item-time">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                    {c.message ? (
                      <span className="mdocs-version-history-item-message">{c.message}</span>
                    ) : null}
                    <span className="mdocs-version-history-item-meta muted">
                      {c.authorVisitorName || c.authorVisitorId.slice(0, 8)}
                      {c.source === "auto" ? " · auto" : ""}
                      {c.isHead ? ` · ${t("versionHistoryCurrent")}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mdocs-version-history-preview">
              {previewBusy || !preview ? (
                <p className="muted" style={{ padding: 16 }}>
                  {t("loading")}
                </p>
              ) : fileType === "html" ? (
                <VersionHtmlPreview content={preview.content} />
              ) : fileType === "sheet" ? (
                <VersionSheetPreview content={preview.content} />
              ) : (
                <VersionMdPreview commitId={preview.commitId} content={preview.content} />
              )}
            </div>
          </div>
        )}

        <footer className="mdocs-version-history-foot">
          {props.canRestore && selected && !selected.isHead ? (
            confirmRestore ? (
              <>
                <span className="muted" style={{ fontSize: 13 }}>
                  {t("versionHistoryRestoreConfirm")}
                </span>
                <button
                  type="button"
                  className="primary"
                  disabled={restoreBusy}
                  onClick={() => void handleRestore()}
                >
                  {restoreBusy ? "…" : t("versionHistoryRestore")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={restoreBusy}
                  onClick={() => setConfirmRestore(false)}
                >
                  {t("cancel")}
                </button>
              </>
            ) : (
              <button type="button" className="primary" onClick={() => setConfirmRestore(true)}>
                {t("versionHistoryRestore")}
              </button>
            )
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>
              {selected?.isHead ? t("versionHistoryCurrent") : null}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
