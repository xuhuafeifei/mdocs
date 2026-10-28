import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "../i18n";
import { ApiRequestError } from "../services/client";
import type { DocumentDetail } from "../../shared/types/document";
import {
  convertContentApi,
  getDocumentCommitApi,
  listDocumentCommitsApi,
  restoreDocumentVersionApi,
  type DocumentCommitDetail,
  type DocumentCommitSummary,
} from "../services/endpoints";

/**
 * 版本预览不再挂第二套 Lobe/Lexical Editor。
 * 生产包 Lexical #38 = setEditorState empty；历史 blob 缺插件节点 / 空 root 时会炸整页。
 * 统一转 Markdown + react-markdown 只读预览。
 */
function detectContentType(content: string): "json" | "markdown" {
  try {
    const parsed = JSON.parse(content) as { root?: { children?: unknown[] } };
    return parsed?.root && Array.isArray(parsed.root.children) ? "json" : "markdown";
  } catch {
    return "markdown";
  }
}

/** 转换失败时从 Lexical JSON 抽纯文本，保证仍能看个大概 */
function lexicalPlainFallback(content: string): string {
  try {
    const walk = (node: unknown): string => {
      if (!node || typeof node !== "object") return "";
      const rec = node as Record<string, unknown>;
      if (typeof rec.text === "string") return rec.text;
      if (!Array.isArray(rec.children)) return "";
      return rec.children.map(walk).join(rec.type === "paragraph" || rec.type === "heading" ? "\n\n" : "");
    };
    const parsed = JSON.parse(content) as { root?: unknown };
    return walk(parsed.root).trim() || "(空版本)";
  } catch {
    return content.trim() || "(空版本)";
  }
}

function VersionMdPreview(props: { commitId: string; content: string }) {
  const { t } = useI18n();
  const [markdown, setMarkdown] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMarkdown(null);
    const raw = props.content ?? "";
    const kind = detectContentType(raw);

    void (async () => {
      if (!raw.trim()) {
        if (!cancelled) setMarkdown("(空版本)");
        return;
      }
      if (kind === "markdown") {
        if (!cancelled) setMarkdown(raw);
        return;
      }
      try {
        const converted = await convertContentApi({
          content: raw,
          from: "lexical",
          to: "markdown",
        });
        if (!cancelled) setMarkdown(converted.content?.trim() ? converted.content : "(空版本)");
      } catch {
        if (!cancelled) setMarkdown(lexicalPlainFallback(raw));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.commitId, props.content]);

  if (markdown === null) {
    return (
      <p className="muted" style={{ padding: 16 }}>
        {t("loading")}
      </p>
    );
  }

  return (
    <div className="mdocs-version-preview-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
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
      setSelectedId((prev) => {
        if (prev && data.some((c) => c.commitId === prev)) return prev;
        const head = data.find((c) => c.isHead) ?? data[0];
        return head?.commitId ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [props.documentId]);

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
              {!preview ? (
                <p className="muted" style={{ padding: 16 }}>
                  {t("loading")}
                </p>
              ) : (
                <div
                  className={
                    "mdocs-version-history-preview-inner" +
                    (previewBusy ? " is-loading" : "")
                  }
                >
                  {fileType === "html" ? (
                    <VersionHtmlPreview content={preview.content} />
                  ) : fileType === "sheet" ? (
                    <VersionSheetPreview content={preview.content} />
                  ) : (
                    <VersionMdPreview commitId={preview.commitId} content={preview.content} />
                  )}
                  {previewBusy ? (
                    <p className="mdocs-version-history-preview-busy muted">{t("loading")}</p>
                  ) : null}
                </div>
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
