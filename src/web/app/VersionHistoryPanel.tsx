import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
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
import { Columns2, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
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
import { bindProportionalScroll, computeSyncedScrollTop } from "./version-compare-scroll";

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

const SYNC_SCROLL_STORAGE_KEY = "mdocs.versionCompare.syncScroll";

type CompareSide = "left" | "right";

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

function VersionMdPreview(props: {
  commitId: string;
  content: string;
  scrollRef?: Ref<HTMLDivElement>;
}) {
  const contentType = useMemo(() => detectContentType(props.content), [props.content]);
  const safe = useMemo(
    () => ensureNonEmptyLexical(props.content, contentType),
    [props.content, contentType],
  );
  return (
    <div className="mdocs-version-preview-editor" ref={props.scrollRef}>
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

/** 下拉选项文案：时间 · 当前 · 提交说明 */
function formatCommitOption(commit: DocumentCommitSummary, currentLabel: string): string {
  const time = new Date(commit.createdAt).toLocaleString();
  const parts = [time];
  if (commit.isHead) parts.push(currentLabel);
  if (commit.message) parts.push(commit.message);
  return parts.join(" · ");
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

  /** 单栏预览 / 左右两栏对比 */
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [fullscreen, setFullscreen] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [syncScroll, setSyncScroll] = useState(() => {
    try {
      return localStorage.getItem(SYNC_SCROLL_STORAGE_KEY) !== "0";
    } catch {
      return true;
    }
  });

  /** 对比态：左右各自持有的版本，允许任一边为空 */
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  /** 下一次点列表要塞进哪一边（点一次左、再点一次右，交替） */
  const [pickSide, setPickSide] = useState<CompareSide>("left");
  const [rightDetail, setRightDetail] = useState<DocumentCommitDetail | null>(null);
  const [rightBusy, setRightBusy] = useState(false);
  const [rightError, setRightError] = useState<string | null>(null);

  /** commitId → detail；左右两栏共用，来回切版本不重复请求 */
  const detailCache = useRef(new Map<string, DocumentCommitDetail>());
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);

  const visibleItems = useMemo(
    () => (hideAuto ? items.filter((c) => c.source !== "auto") : items),
    [items, hideAuto],
  );

  /** 左栏内容来源：单栏 = 列表选中；对比 = 明确指定的左侧版本 */
  const leftSourceId = mode === "compare" ? leftId : selectedId;
  const leftCommit = useMemo(
    () => items.find((c) => c.commitId === leftSourceId) ?? null,
    [items, leftSourceId],
  );
  /** 恢复只作用于左栏（单栏时即列表选中） */
  const restoreCommit = leftCommit;
  const restoreId = leftSourceId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // commit blob 不可变：缓存可跨刷新复用，只让右栏失效
    setRightDetail(null);
    try {
      const data = await listDocumentCommitsApi(props.documentId);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [props.documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 单栏选中项跟随列表与「隐藏自动发布」过滤：保持当前选中；失效则回到 head
  useEffect(() => {
    if (mode !== "single") return;
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }
    const stillThere = selectedId
      ? visibleItems.some((c) => c.commitId === selectedId)
      : false;
    if (stillThere) return;
    const next = visibleItems.find((c) => c.isHead) ?? visibleItems[0] ?? items[0];
    setSelectedId(next?.commitId ?? null);
    setConfirmRestore(false);
  }, [mode, items, visibleItems, selectedId]);

  // 对比态：被隐藏/已删除的 commit 从两侧摘掉
  useEffect(() => {
    if (mode !== "compare") return;
    const exists = (id: string | null) =>
      !!id && visibleItems.some((c) => c.commitId === id);
    if (leftId && !exists(leftId)) setLeftId(null);
    if (rightId && !exists(rightId)) setRightId(null);
  }, [mode, visibleItems, leftId, rightId]);

  useEffect(() => {
    try {
      sessionStorage.setItem("mdocs.versionHistory.hideAuto", hideAuto ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [hideAuto]);

  // 左栏内容
  useEffect(() => {
    if (!leftSourceId) {
      setPreview(null);
      return;
    }
    const cached = detailCache.current.get(leftSourceId);
    if (cached) {
      setPreview(cached);
      setPreviewBusy(false);
      return;
    }
    let cancelled = false;
    setPreviewBusy(true);
    void getDocumentCommitApi(props.documentId, leftSourceId)
      .then((d) => {
        detailCache.current.set(leftSourceId, d);
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
  }, [props.documentId, leftSourceId]);

  // 右栏内容（对比态才需要）
  useEffect(() => {
    if (mode !== "compare" || !rightId) {
      setRightDetail(null);
      setRightBusy(false);
      setRightError(null);
      return;
    }
    const cached = detailCache.current.get(rightId);
    if (cached) {
      setRightDetail(cached);
      setRightError(null);
      return;
    }
    let cancelled = false;
    setRightBusy(true);
    setRightError(null);
    void getDocumentCommitApi(props.documentId, rightId)
      .then((d) => {
        detailCache.current.set(rightId, d);
        if (!cancelled) setRightDetail(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setRightDetail(null);
          setRightError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setRightBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, rightId, props.documentId]);

  useEffect(() => {
    try {
      localStorage.setItem(SYNC_SCROLL_STORAGE_KEY, syncScroll ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [syncScroll]);

  // 联动滚动：只按滚动比例映射，不做内容 diff
  useEffect(() => {
    if (mode !== "compare" || !syncScroll) return;
    if (!preview?.commitId || !rightDetail?.commitId) return;
    const left = leftScrollRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;
    const unbind = bindProportionalScroll(left, right);
    // Lobe 渲染后高度才稳定，下一帧按左栏对齐一次
    const raf = requestAnimationFrame(() => {
      const next = computeSyncedScrollTop(left, right);
      if (Math.abs(right.scrollTop - next) >= 1) right.scrollTop = next;
    });
    return () => {
      cancelAnimationFrame(raf);
      unbind();
    };
  }, [mode, syncScroll, preview?.commitId, rightDetail?.commitId]);

  // 全屏下 Esc 先退全屏（capture，抢在其它处理器之前）
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setFullscreen(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [fullscreen]);

  function enterCompare(): void {
    setLeftId(null);
    setRightId(null);
    setPickSide("left");
    setConfirmRestore(false);
    setMode("compare");
  }

  function exitCompare(): void {
    setMode("single");
    if (leftId) setSelectedId(leftId);
  }

  /** 列表点选：已选则取消；否则放进当前待选的一侧，并交替到另一侧 */
  function assignVersion(commitId: string): void {
    setConfirmRestore(false);
    if (leftId === commitId) {
      setLeftId(null);
      setPickSide("left");
      return;
    }
    if (rightId === commitId) {
      setRightId(null);
      setPickSide("right");
      return;
    }
    if (pickSide === "left") {
      setLeftId(commitId);
      setPickSide("right");
    } else {
      setRightId(commitId);
      setPickSide("left");
    }
  }

  async function handleRestore(): Promise<void> {
    if (!restoreId || restoreBusy) return;
    setRestoreBusy(true);
    setError(null);
    try {
      const doc = await restoreDocumentVersionApi(props.documentId, restoreId);
      setMode("single");
      setFullscreen(false);
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

  const compareOnlyForMd = fileType === "md";
  const canCompare = compareOnlyForMd && visibleItems.length >= 2;
  const compareTitle = canCompare ? undefined : t("versionCompareNeedTwo");
  const bothPicked = !!leftId && !!rightId;
  const pickHint = bothPicked
    ? t("versionPickHintDone")
    : pickSide === "left"
      ? t("versionPickHintLeft")
      : t("versionPickHintRight");

  return (
    <div className="mdocs-dialog-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className={
          "mdocs-dialog card mdocs-version-history-dialog" +
          (fullscreen ? " is-fullscreen" : "") +
          (mode === "compare" ? " is-compare" : "")
        }
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
          <div className="mdocs-version-history-actions">
            {mode === "compare" ? (
              <button
                type="button"
                className="ghost mdocs-tooltip mdocs-tooltip-bottom mdocs-version-icon-btn"
                onClick={() => setListCollapsed((v) => !v)}
                aria-label={listCollapsed ? t("versionExpandList") : t("versionCollapseList")}
                data-tooltip={listCollapsed ? t("versionExpandList") : t("versionCollapseList")}
              >
                {listCollapsed ? (
                  <PanelLeftOpen size={18} strokeWidth={1.5} />
                ) : (
                  <PanelLeftClose size={18} strokeWidth={1.5} />
                )}
              </button>
            ) : null}
            {compareOnlyForMd ? (
              <button
                type="button"
                className="ghost mdocs-tooltip mdocs-tooltip-bottom mdocs-version-icon-btn mdocs-version-compare-toggle"
                disabled={!canCompare}
                aria-pressed={mode === "compare"}
                aria-label={mode === "compare" ? t("versionCompareExit") : t("versionCompare")}
                data-tooltip={
                  mode === "compare" ? t("versionCompareExit") : (compareTitle ?? t("versionCompare"))
                }
                onClick={() => {
                  if (mode === "compare") exitCompare();
                  else enterCompare();
                }}
              >
                <Columns2 size={18} strokeWidth={1.5} />
              </button>
            ) : null}
            <button
              type="button"
              className="ghost mdocs-tooltip mdocs-tooltip-bottom mdocs-version-icon-btn"
              aria-pressed={fullscreen}
              aria-label={fullscreen ? t("versionExitFullscreen") : t("versionFullscreen")}
              data-tooltip={fullscreen ? t("versionExitFullscreen") : t("versionFullscreen")}
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? (
                <Minimize2 size={18} strokeWidth={1.5} />
              ) : (
                <Maximize2 size={18} strokeWidth={1.5} />
              )}
            </button>
            <button
              type="button"
              className="ghost mdocs-tooltip mdocs-tooltip-bottom mdocs-version-icon-btn"
              aria-label={t("close")}
              data-tooltip={t("close")}
              onClick={props.onClose}
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
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
            <ul
              className={
                "mdocs-version-history-list" +
                (mode === "compare" ? " is-narrow" : "") +
                (mode === "compare" && listCollapsed ? " is-collapsed" : "")
              }
            >
              {mode === "compare" ? (
                <li className="mdocs-version-pick-hint" aria-live="polite">
                  {pickHint}
                </li>
              ) : null}
              {visibleItems.map((c) => {
                const isLeft = c.commitId === leftId;
                const isRight = c.commitId === rightId;
                const cls =
                  "mdocs-version-history-item" +
                  (mode === "compare"
                    ? isLeft || isRight
                      ? " is-picked"
                      : ""
                    : c.commitId === selectedId
                      ? " is-active"
                      : "");
                return (
                  <li key={c.commitId}>
                    <button
                      type="button"
                      className={cls}
                      onClick={() => {
                        if (mode === "compare") assignVersion(c.commitId);
                        else {
                          setConfirmRestore(false);
                          setSelectedId(c.commitId);
                        }
                      }}
                    >
                      <span className="mdocs-version-history-item-time">
                        {new Date(c.createdAt).toLocaleString()}
                        {mode === "compare" && (isLeft || isRight) ? (
                          <span className="mdocs-version-pick-badges">
                            {isLeft ? (
                              <span className="mdocs-version-pick-badge">{t("versionSideLeft")}</span>
                            ) : null}
                            {isRight ? (
                              <span className="mdocs-version-pick-badge is-right">
                                {t("versionSideRight")}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
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
                );
              })}
            </ul>

            {mode === "compare" ? (
              <div className="mdocs-version-compare">
                <section className="mdocs-version-compare-pane">
                  <header className="mdocs-version-compare-pane-head">
                    <span className="mdocs-version-compare-badge">{t("versionCompareLeft")}</span>
                    <select
                      className="mdocs-version-compare-select"
                      value={leftId ?? ""}
                      aria-label={t("versionCompareLeft")}
                      onChange={(e) => {
                        setConfirmRestore(false);
                        setLeftId(e.target.value || null);
                      }}
                    >
                      <option value="">{t("versionPickEmptyShort")}</option>
                      {visibleItems.map((c) => (
                        <option key={c.commitId} value={c.commitId}>
                          {formatCommitOption(c, t("versionHistoryCurrent"))}
                        </option>
                      ))}
                    </select>
                  </header>
                  <div className="mdocs-version-compare-pane-body">
                    {!leftId ? (
                      <p className="mdocs-version-compare-empty muted">{t("versionPickEmpty")}</p>
                    ) : previewBusy || !preview ? (
                      <p className="muted" style={{ padding: 16 }}>
                        {t("loading")}
                      </p>
                    ) : (
                      <VersionMdPreview
                        commitId={preview.commitId}
                        content={preview.content}
                        scrollRef={leftScrollRef}
                      />
                    )}
                  </div>
                </section>

                <section className="mdocs-version-compare-pane">
                  <header className="mdocs-version-compare-pane-head">
                    <span className="mdocs-version-compare-badge is-current">
                      {t("versionCompareRight")}
                    </span>
                    <select
                      className="mdocs-version-compare-select"
                      value={rightId ?? ""}
                      aria-label={t("versionCompareRight")}
                      onChange={(e) => setRightId(e.target.value || null)}
                    >
                      <option value="">{t("versionPickEmptyShort")}</option>
                      {visibleItems.map((c) => (
                        <option key={c.commitId} value={c.commitId}>
                          {formatCommitOption(c, t("versionHistoryCurrent"))}
                        </option>
                      ))}
                    </select>
                  </header>
                  <div className="mdocs-version-compare-pane-body">
                    {!rightId ? (
                      <p className="mdocs-version-compare-empty muted">{t("versionPickEmpty")}</p>
                    ) : rightBusy ? (
                      <p className="muted" style={{ padding: 16 }}>
                        {t("loading")}
                      </p>
                    ) : rightError ? (
                      <p className="mdocs-dialog-error" role="alert" style={{ padding: 16 }}>
                        {rightError}
                      </p>
                    ) : rightDetail ? (
                      <VersionMdPreview
                        commitId={rightDetail.commitId}
                        content={rightDetail.content}
                        scrollRef={rightScrollRef}
                      />
                    ) : (
                      <p className="muted" style={{ padding: 16 }}>
                        {t("versionHistoryEmpty")}
                      </p>
                    )}
                  </div>
                </section>
              </div>
            ) : (
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
            )}
          </div>
        )}

        <footer className="mdocs-version-history-foot">
          {mode === "compare" ? (
            <label
              className="mdocs-version-compare-sync"
              title={bothPicked ? t("versionCompareSyncHint") : t("versionPickNeedBoth")}
            >
              <input
                type="checkbox"
                checked={syncScroll && bothPicked}
                disabled={!bothPicked}
                onChange={(e) => setSyncScroll(e.target.checked)}
              />
              {t("versionCompareSync")}
            </label>
          ) : null}
          <span className="mdocs-version-history-foot-spacer" />
          {props.canRestore && restoreCommit && !restoreCommit.isHead ? (
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
              <button
                type="button"
                className="primary"
                disabled={!restoreId}
                onClick={() => setConfirmRestore(true)}
              >
                {t("versionHistoryRestore")}
              </button>
            )
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>
              {restoreCommit?.isHead ? t("versionHistoryCurrent") : null}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
