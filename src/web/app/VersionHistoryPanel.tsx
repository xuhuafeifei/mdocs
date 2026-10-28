import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SerializedEditorState } from "lexical";
import { Expand, Minimize2 } from "lucide-react";
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

/** Local chunk + one retry against Vite 504 Outdated Optimize Dep. */
const LexicalDiff = lazy(async () => {
  try {
    return await import("./VersionHistoryLexicalDiff");
  } catch {
    await new Promise((r) => window.setTimeout(r, 300));
    return await import("./VersionHistoryLexicalDiff");
  }
});




type PanelMode = "preview" | "compare";

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

function emptyEditorState(): SerializedEditorState {
  return {
    root: {
      children: [
        {
          children: [],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  } as unknown as SerializedEditorState;
}

/** commit blob → LexicalDiff 所需 SerializedEditorState */
async function contentToEditorState(content: string): Promise<SerializedEditorState> {
  const raw = content ?? "";
  if (!raw.trim()) return emptyEditorState();
  if (detectContentType(raw) === "json") {
    return JSON.parse(raw) as SerializedEditorState;
  }
  const converted = await convertContentApi({
    content: raw,
    from: "markdown",
    to: "lexical",
  });
  if (!converted.content?.trim()) return emptyEditorState();
  if (detectContentType(converted.content) === "json") {
    return JSON.parse(converted.content) as SerializedEditorState;
  }
  throw new Error("markdown→lexical 结果无效");
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

function formatCommitLabel(c: DocumentCommitSummary | null | undefined): string {
  if (!c) return "";
  const time = new Date(c.createdAt).toLocaleString();
  return c.message ? `${time} · ${c.message}` : time;
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
  const compareSupported = fileType === "md";
  const [items, setItems] = useState<DocumentCommitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentCommitDetail | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [mode, setMode] = useState<PanelMode>("preview");
  const [fullscreen, setFullscreen] = useState(false);
  const [oldCommitId, setOldCommitId] = useState<string | null>(null);
  const [newCommitId, setNewCommitId] = useState<string | null>(null);
  const [oldState, setOldState] = useState<SerializedEditorState | null>(null);
  const [newState, setNewState] = useState<SerializedEditorState | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
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

  const oldCommit = items.find((c) => c.commitId === oldCommitId) ?? null;
  const newCommit = items.find((c) => c.commitId === newCommitId) ?? null;

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
    if (hideAuto) {
      if (oldCommitId && !items.some((c) => c.commitId === oldCommitId && c.source !== "auto")) {
        setOldCommitId(null);
      }
      if (newCommitId && !items.some((c) => c.commitId === newCommitId && c.source !== "auto")) {
        setNewCommitId(null);
      }
    }
  }, [hideAuto, items, selectedId, oldCommitId, newCommitId]);

  useEffect(() => {
    if (mode !== "preview" || !selectedId) {
      if (mode === "preview" && !selectedId) setPreview(null);
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
  }, [props.documentId, selectedId, mode]);

  useEffect(() => {
    if (mode !== "compare" || !compareSupported) {
      return;
    }
    if (!oldCommitId || !newCommitId) {
      setOldState(null);
      setNewState(null);
      setCompareError(null);
      setCompareBusy(false);
      return;
    }
    if (oldCommitId === newCommitId) {
      setOldState(null);
      setNewState(null);
      setCompareError(t("versionHistoryCompareSame"));
      setCompareBusy(false);
      return;
    }

    let cancelled = false;
    setCompareBusy(true);
    setCompareError(null);
    void (async () => {
      try {
        const [oldDetail, newDetail] = await Promise.all([
          getDocumentCommitApi(props.documentId, oldCommitId),
          getDocumentCommitApi(props.documentId, newCommitId),
        ]);
        const [o, n] = await Promise.all([
          contentToEditorState(oldDetail.content),
          contentToEditorState(newDetail.content),
        ]);
        if (!cancelled) {
          setOldState(o);
          setNewState(n);
        }
      } catch (err) {
        if (!cancelled) {
          setOldState(null);
          setNewState(null);
          setCompareError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setCompareBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, compareSupported, props.documentId, oldCommitId, newCommitId, t]);

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

  function assignCompareSide(side: "old" | "new", commitId: string): void {
    setError(null);
    if (side === "old") {
      // 再点一次已选的「旧」→ 取消
      if (oldCommitId === commitId) {
        setOldCommitId(null);
        return;
      }
      // 点在已是「新」的那一行 → 互换
      if (newCommitId === commitId) {
        setNewCommitId(oldCommitId);
        setOldCommitId(commitId);
        return;
      }
      setOldCommitId(commitId);
      return;
    }
    if (newCommitId === commitId) {
      setNewCommitId(null);
      return;
    }
    if (oldCommitId === commitId) {
      setOldCommitId(newCommitId);
      setNewCommitId(commitId);
      return;
    }
    setNewCommitId(commitId);
  }

  function switchMode(next: PanelMode): void {
    if (next === "compare" && !compareSupported) return;
    setMode(next);
    setConfirmRestore(false);
    setError(null);
  }

  const selected = items.find((c) => c.commitId === selectedId) ?? null;

  return (
    <div
      className={
        "mdocs-dialog-backdrop" + (fullscreen ? " mdocs-version-history-backdrop--fullscreen" : "")
      }
      role="presentation"
      onClick={fullscreen ? undefined : props.onClose}
    >
      <div
        className={
          "mdocs-dialog card mdocs-version-history-dialog" +
          (fullscreen ? " is-fullscreen" : "")
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdocs-version-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mdocs-version-history-head">
          <div className="mdocs-version-history-head-main">
            <h1 id="mdocs-version-history-title">{t("versionHistoryTitle")}</h1>
            <p className="mdocs-version-history-desc">{t("versionHistoryDesc")}</p>
            <div className="mdocs-version-history-head-tools">
              <div className="mdocs-version-history-mode" role="group" aria-label={t("versionHistoryMode")}>
                <button
                  type="button"
                  className={"ghost" + (mode === "preview" ? " is-active" : "")}
                  onClick={() => switchMode("preview")}
                >
                  {t("versionHistoryModePreview")}
                </button>
                <button
                  type="button"
                  className={"ghost" + (mode === "compare" ? " is-active" : "")}
                  disabled={!compareSupported}
                  title={compareSupported ? undefined : t("versionHistoryCompareMdOnly")}
                  onClick={() => switchMode("compare")}
                >
                  {t("versionHistoryModeCompare")}
                </button>
              </div>
              <label className="mdocs-version-history-filter muted">
                <input
                  type="checkbox"
                  checked={hideAuto}
                  onChange={(e) => setHideAuto(e.target.checked)}
                />
                {t("versionHistoryHideAuto")}
              </label>
            </div>
          </div>
          <div className="mdocs-version-history-head-actions">
            <button
              type="button"
              className="secondary mdocs-version-history-icon-btn"
              onClick={() => setFullscreen((v) => !v)}
              title={fullscreen ? t("versionHistoryExitFullscreen") : t("versionHistoryFullscreen")}
              aria-label={fullscreen ? t("versionHistoryExitFullscreen") : t("versionHistoryFullscreen")}
            >
              {fullscreen ? <Minimize2 size={16} /> : <Expand size={16} />}
            </button>
            <button type="button" className="secondary" onClick={props.onClose}>
              {t("close")}
            </button>
          </div>
        </header>

        {error ? (
          <p className="mdocs-dialog-error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="muted" style={{ padding: "0 24px" }}>
            {t("loading")}
          </p>
        ) : items.length === 0 ? (
          <p className="muted" style={{ padding: "0 24px" }}>
            {t("versionHistoryEmpty")}
          </p>
        ) : visibleItems.length === 0 ? (
          <p className="muted" style={{ padding: "0 24px" }}>
            {t("versionHistoryEmpty")}
          </p>
        ) : (
          <div className="mdocs-version-history-body">
            <ul className="mdocs-version-history-list">
              {visibleItems.map((c) => {
                const isPreviewActive = mode === "preview" && c.commitId === selectedId;
                const isOld = mode === "compare" && c.commitId === oldCommitId;
                const isNew = mode === "compare" && c.commitId === newCommitId;
                return (
                  <li key={c.commitId}>
                    {mode === "preview" ? (
                      <button
                        type="button"
                        className={
                          "mdocs-version-history-item" + (isPreviewActive ? " is-active" : "")
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
                    ) : (
                      <div
                        className={
                          "mdocs-version-history-item mdocs-version-history-item--compare" +
                          (isOld ? " is-old" : "") +
                          (isNew ? " is-new" : "")
                        }
                      >
                        <div className="mdocs-version-history-item-main">
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
                        </div>
                        <div className="mdocs-version-history-item-sides">
                          <button
                            type="button"
                            className={"ghost mdocs-version-side" + (isOld ? " is-active" : "")}
                            onClick={() => assignCompareSide("old", c.commitId)}
                          >
                            {t("versionHistoryCompareOld")}
                          </button>
                          <button
                            type="button"
                            className={"ghost mdocs-version-side" + (isNew ? " is-active" : "")}
                            onClick={() => assignCompareSide("new", c.commitId)}
                          >
                            {t("versionHistoryCompareNew")}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mdocs-version-history-preview">
              {mode === "preview" ? (
                !preview ? (
                  <p className="muted" style={{ padding: 16 }}>
                    {t("loading")}
                  </p>
                ) : (
                  <div
                    className={
                      "mdocs-version-history-preview-inner" + (previewBusy ? " is-loading" : "")
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
                )
              ) : !compareSupported ? (
                <p className="muted" style={{ padding: 16 }}>
                  {t("versionHistoryCompareMdOnly")}
                </p>
              ) : !oldCommitId || !newCommitId ? (
                <p className="muted" style={{ padding: 16 }}>
                  {!oldCommitId && !newCommitId
                    ? t("versionHistoryComparePickBoth")
                    : !oldCommitId
                      ? t("versionHistoryComparePickOld")
                      : t("versionHistoryComparePickNew")}
                </p>
              ) : compareError ? (
                <p className="mdocs-dialog-error" style={{ margin: 16 }} role="alert">
                  {compareError}
                </p>
              ) : compareBusy || !oldState || !newState ? (
                <p className="muted" style={{ padding: 16 }}>
                  {t("loading")}
                </p>
              ) : (
                <div className="mdocs-version-history-diff">
                  <Suspense
                    fallback={
                      <p className="muted" style={{ padding: 16 }}>
                        {t("loading")}
                      </p>
                    }
                  >
                    <LexicalDiff
                      oldValue={oldState}
                      newValue={newState}
                      labels={{
                        old: formatCommitLabel(oldCommit),
                        new: formatCommitLabel(newCommit),
                      }}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="mdocs-version-history-foot">
          {mode === "compare" ? (
            <span className="muted" style={{ fontSize: 13 }}>
              {oldCommit && newCommit
                ? `${formatCommitLabel(oldCommit)} → ${formatCommitLabel(newCommit)}`
                : t("versionHistoryCompareHint")}
            </span>
          ) : props.canRestore && selected && !selected.isHead ? (
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
