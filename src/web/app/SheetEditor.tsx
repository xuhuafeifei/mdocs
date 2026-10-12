/**
 * SheetEditor — `.sheet` 工作簿 + DocChrome。
 * 支持单元格样式（底色/字色/粗斜体/字号）与合并单元格。
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Bold, Italic, Merge, Plus, SplitSquareHorizontal, Trash2, X } from "lucide-react";
import type { ActiveDocumentMeta } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import {
  addSheetColumn,
  addSheetRow,
  addWorkbookSheet,
  findMergeAt,
  getCellStyle,
  getCellValue,
  isCoveredCell,
  isMergeMaster,
  mergeSheetCells,
  mergeSpan,
  parseSheetDocument,
  removeSheetColumns,
  removeSheetRow,
  removeWorkbookSheet,
  renameWorkbookSheet,
  replaceSheetTab,
  resolveSheetTab,
  serializeSheetDocument,
  setActiveSheet,
  setSheetCell,
  setSheetCellStyle,
  setSheetColumnName,
  unmergeSheetCells,
  type SheetCellStyle,
  type SheetDocument,
  type SheetTab,
} from "../../shared/sheetDocument";
import { useI18n } from "../i18n";
import { DocChrome } from "./DocChrome";
import { getDocumentTaskQueue } from "./documentTaskQueue";
import {
  draftPresenceGeneration,
  getDraft,
  subscribeDraftPresence,
  upsertContentDraft,
} from "../storage/drafts";
import {
  addBookmarkApi,
  checkBookmarkApi,
  removeBookmarkApi,
} from "../services/endpoints";
import "./SheetEditor.css";

interface SheetEditorProps {
  meta: ActiveDocumentMeta;
  initialContent: string;
  initialDisplayName: string;
  contentRevision?: number;
  canEdit: boolean;
  domains: DomainSummary[];
  currentDomainId: string;
  onDomainChange: (domainId: string) => void;
  onDomainsChange?: (domains: DomainSummary[]) => void;
  onContentChange?: (content: string) => void;
  onPublish: (
    content: string,
    displayName: string,
    documentId: string,
    permission?: number,
  ) => Promise<void>;
  onDraftExistsChange?: (exists: boolean) => void;
  hasLocalDraft?: boolean;
  syncBehind?: boolean;
  onSyncClick?: () => void;
  onDelete: () => Promise<void>;
  onToggleComments?: () => void;
  commentPanelOpen?: boolean;
  commentCount?: number;
  onShowToast?: (message: string) => void;
  readerChrome?: boolean;
  onOpenMobileNav?: () => void;
}

type CellRef = { rowId: string; colId: string };

function cellKey(c: CellRef): string {
  return `${c.rowId}::${c.colId}`;
}

function enumerateSelection(tab: SheetTab, a: CellRef, b: CellRef): CellRef[] {
  const r0 = tab.rows.findIndex((r) => r.id === a.rowId);
  const r1 = tab.rows.findIndex((r) => r.id === b.rowId);
  const c0 = tab.columns.findIndex((c) => c.id === a.colId);
  const c1 = tab.columns.findIndex((c) => c.id === b.colId);
  if (r0 < 0 || r1 < 0 || c0 < 0 || c1 < 0) return [a];
  const rs = Math.min(r0, r1);
  const re = Math.max(r0, r1);
  const cs = Math.min(c0, c1);
  const ce = Math.max(c0, c1);
  const out: CellRef[] = [];
  for (let ri = rs; ri <= re; ri += 1) {
    for (let ci = cs; ci <= ce; ci += 1) {
      out.push({ rowId: tab.rows[ri]!.id, colId: tab.columns[ci]!.id });
    }
  }
  return out;
}

function cellInputStyle(style: SheetCellStyle | undefined): CSSProperties {
  if (!style) return {};
  return {
    background: style.bg,
    color: style.color,
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
  };
}

export function SheetEditor(props: SheetEditorProps) {
  const { t } = useI18n();
  const documentId = props.meta.documentId;

  const [workbook, setWorkbook] = useState<SheetDocument>(() =>
    parseSheetDocument(props.initialContent),
  );
  const [displayName, setDisplayName] = useState(props.initialDisplayName);
  const [busy, setBusy] = useState(false);
  const [draftExists, setDraftExists] = useState(props.hasLocalDraft ?? false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renamingColId, setRenamingColId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<CellRef | null>(null);
  const [focus, setFocus] = useState<CellRef | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingSelectRef = useRef(false);
  const anchorRef = useRef<CellRef | null>(null);
  const workbookRef = useRef(workbook);
  const displayNameRef = useRef(displayName);
  workbookRef.current = workbook;
  displayNameRef.current = displayName;
  anchorRef.current = anchor;

  useEffect(() => {
    const onUp = () => {
      draggingSelectRef.current = false;
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  const activeTab: SheetTab =
    resolveSheetTab(workbook) ?? workbook.sheets[0]!;

  const selection = anchor && focus ? enumerateSelection(activeTab, anchor, focus) : [];
  const selectedKeys = new Set(selection.map(cellKey));

  useEffect(() => {
    setWorkbook(parseSheetDocument(props.initialContent));
    setDisplayName(props.initialDisplayName);
    setAnchor(null);
    setFocus(null);
    setRenamingColId(null);
  }, [documentId, props.contentRevision, props.initialContent, props.initialDisplayName]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = await getDraft(documentId);
      if (cancelled || !draft || draft.contentKind !== "sheet") return;
      setWorkbook(parseSheetDocument(draft.content));
      if (draft.displayName) setDisplayName(draft.displayName);
      setDraftExists(true);
      props.onDraftExistsChange?.(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    return subscribeDraftPresence((id, exists) => {
      if (id !== documentId) return;
      setDraftExists(exists);
      props.onDraftExistsChange?.(exists);
      void draftPresenceGeneration();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    void checkBookmarkApi(documentId).then((r) => {
      if (!cancelled) setIsBookmarked(Boolean(r?.bookmarked));
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const persistDraft = useCallback(async () => {
    await getDocumentTaskQueue(documentId).execute(() =>
      upsertContentDraft({
        documentId,
        content: serializeSheetDocument(workbookRef.current),
        displayName: displayNameRef.current,
        contentKind: "sheet",
        localBaseCommitIdAtEditStart: props.meta.headCommitId ?? null,
        snapshotMeta: {
          permission: props.meta.permission,
          ownerVisitorId: props.meta.ownerVisitorId,
          domainId: props.meta.domainId,
        },
      }),
    );
    setDraftExists(true);
    props.onDraftExistsChange?.(true);
  }, [documentId, props]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persistDraft();
    }, 1000);
  }, [persistDraft]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function mutateWorkbook(next: SheetDocument): void {
    if (!props.canEdit) return;
    setWorkbook(next);
    props.onContentChange?.(serializeSheetDocument(next));
    scheduleSave();
  }

  function mutateTab(nextTab: SheetTab): void {
    mutateWorkbook(replaceSheetTab(workbook, nextTab));
  }

  /** 单元格选区（非 input 文本选区）。Shift+点 或 拖选。 */
  function beginCellSelect(ref: CellRef, shift: boolean, ev: ReactMouseEvent): void {
    if (shift && anchorRef.current) {
      // 挡住 input 的文本选择 / 焦点抢占
      ev.preventDefault();
      setFocus(ref);
      return;
    }
    draggingSelectRef.current = true;
    setAnchor(ref);
    setFocus(ref);
    anchorRef.current = ref;
  }

  function extendCellSelect(ref: CellRef): void {
    if (!draggingSelectRef.current) return;
    setFocus(ref);
  }

  function setSelectionRange(start: CellRef, end: CellRef): void {
    setAnchor(start);
    setFocus(end);
    anchorRef.current = start;
  }

  /** 单击列头：全选该列；Shift+单击：扩展到该列 */
  function selectEntireColumn(colId: string, shift: boolean, ev: ReactMouseEvent): void {
    ev.preventDefault();
    const rows = activeTab.rows;
    if (rows.length === 0) return;
    const top = rows[0]!.id;
    const bottom = rows[rows.length - 1]!.id;
    if (shift && anchorRef.current) {
      setFocus({ rowId: bottom, colId });
      return;
    }
    setSelectionRange({ rowId: top, colId }, { rowId: bottom, colId });
  }

  /** 单击行号：全选该行；Shift+单击：扩展到该行 */
  function selectEntireRow(rowId: string, shift: boolean, ev: ReactMouseEvent): void {
    ev.preventDefault();
    const cols = activeTab.columns;
    if (cols.length === 0) return;
    const left = cols[0]!.id;
    const right = cols[cols.length - 1]!.id;
    if (shift && anchorRef.current) {
      setFocus({ rowId, colId: right });
      return;
    }
    setSelectionRange({ rowId, colId: left }, { rowId, colId: right });
  }

  /** 单击左上角 #：全选 */
  function selectAllCells(ev: ReactMouseEvent): void {
    ev.preventDefault();
    const rows = activeTab.rows;
    const cols = activeTab.columns;
    if (rows.length === 0 || cols.length === 0) return;
    setSelectionRange(
      { rowId: rows[0]!.id, colId: cols[0]!.id },
      { rowId: rows[rows.length - 1]!.id, colId: cols[cols.length - 1]!.id },
    );
  }

  function applyStylePatch(patch: SheetCellStyle | null): void {
    if (!props.canEdit || selection.length === 0) return;
    let next = activeTab;
    for (const cell of selection) {
      next = setSheetCellStyle(next, cell.rowId, cell.colId, patch);
    }
    mutateTab(next);
  }

  function toggleBold(): void {
    const sample = selection[0];
    if (!sample) return;
    const cur = getCellStyle(
      activeTab.rows.find((r) => r.id === sample.rowId)?.cells[sample.colId],
    );
    applyStylePatch({ bold: !cur?.bold });
  }

  function toggleItalic(): void {
    const sample = selection[0];
    if (!sample) return;
    const cur = getCellStyle(
      activeTab.rows.find((r) => r.id === sample.rowId)?.cells[sample.colId],
    );
    applyStylePatch({ italic: !cur?.italic });
  }

  function doMerge(): void {
    if (!props.canEdit || !anchor || !focus) return;
    try {
      mutateTab(
        mergeSheetCells(activeTab, {
          startRowId: anchor.rowId,
          startColId: anchor.colId,
          endRowId: focus.rowId,
          endColId: focus.colId,
        }),
      );
    } catch {
      /* overlap or single cell */
    }
  }

  function doUnmerge(): void {
    if (!props.canEdit || !focus) return;
    const { tab } = unmergeSheetCells(activeTab, focus.rowId, focus.colId);
    mutateTab(tab);
  }

  async function publish(): Promise<void> {
    if (!props.canEdit) return;
    const scrollHost = document.querySelector(
      ".mdocs-sheet-scroll",
    ) as HTMLElement | null;
    const savedScrollTop = scrollHost?.scrollTop ?? null;
    const savedScrollLeft = scrollHost?.scrollLeft ?? null;
    setBusy(true);
    try {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await persistDraft();
      await props.onPublish(
        serializeSheetDocument(workbookRef.current),
        displayNameRef.current.trim() || displayName,
        documentId,
      );
      setDraftExists(false);
      props.onDraftExistsChange?.(false);
    } finally {
      setBusy(false);
      if (scrollHost && savedScrollTop != null) {
        scrollHost.scrollTop = savedScrollTop;
        if (savedScrollLeft != null) scrollHost.scrollLeft = savedScrollLeft;
        requestAnimationFrame(() => {
          scrollHost.scrollTop = savedScrollTop;
          if (savedScrollLeft != null) scrollHost.scrollLeft = savedScrollLeft;
        });
      }
    }
  }

  async function saveDisplayNameIfChanged(): Promise<void> {
    if (!props.canEdit) return;
    if (displayName.trim() === props.initialDisplayName.trim()) return;
    try {
      await publish();
    } catch {
      /* parent handles */
    }
  }

  async function toggleBookmark(): Promise<void> {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      if (isBookmarked) {
        await removeBookmarkApi(documentId);
        setIsBookmarked(false);
        props.onShowToast?.(t("bookmarkRemoved"));
      } else {
        await addBookmarkApi(documentId);
        setIsBookmarked(true);
        props.onShowToast?.(t("bookmarkAdded"));
      }
    } finally {
      setBookmarkBusy(false);
    }
  }

  const sampleStyle = (() => {
    const sample = selection[0];
    if (!sample) return undefined;
    return getCellStyle(
      activeTab.rows.find((r) => r.id === sample.rowId)?.cells[sample.colId],
    );
  })();

  return (
    <div className="mdocs-sheet-editor">
      <DocChrome
        fileType="sheet"
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        onDisplayNameBlur={() => void saveDisplayNameIfChanged()}
        domains={props.domains}
        currentDomainId={props.currentDomainId}
        onDomainChange={props.onDomainChange}
        onDomainsChange={props.onDomainsChange}
        canEdit={props.canEdit}
        editing
        actionsAlwaysVisible
        syncBehind={props.syncBehind}
        onSyncClick={props.onSyncClick}
        busy={busy}
        draftExists={draftExists}
        onPublish={() => void publish()}
        onDelete={() => void props.onDelete()}
        isBookmarked={isBookmarked}
        bookmarkBusy={bookmarkBusy}
        onToggleBookmark={() => void toggleBookmark()}
        onToggleComments={props.onToggleComments}
        commentPanelOpen={props.commentPanelOpen}
        commentCount={props.commentCount}
        readerChrome={props.readerChrome}
        onOpenMobileNav={props.onOpenMobileNav}
      />

      <div className="mdocs-sheet-toolbar">
        <div className="mdocs-sheet-toolbar-left">
          <button
            type="button"
            className="mdocs-sheet-btn"
            disabled={!props.canEdit}
            onClick={() => mutateTab(addSheetRow(activeTab))}
          >
            <Plus size={13} strokeWidth={2.2} />
            <span>{t("sheetAddRow")}</span>
          </button>
          <button
            type="button"
            className="mdocs-sheet-btn"
            disabled={!props.canEdit}
            onClick={() => mutateTab(addSheetColumn(activeTab))}
          >
            <Plus size={13} strokeWidth={2.2} />
            <span>{t("sheetAddColumn")}</span>
          </button>
          <span className="mdocs-sheet-toolbar-sep" aria-hidden />
          <button
            type="button"
            className={`mdocs-sheet-btn mdocs-sheet-btn-icon${sampleStyle?.bold ? " is-active" : ""}`}
            disabled={!props.canEdit || selection.length === 0}
            title={t("sheetBold")}
            onClick={toggleBold}
          >
            <Bold size={13} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className={`mdocs-sheet-btn mdocs-sheet-btn-icon${sampleStyle?.italic ? " is-active" : ""}`}
            disabled={!props.canEdit || selection.length === 0}
            title={t("sheetItalic")}
            onClick={toggleItalic}
          >
            <Italic size={13} strokeWidth={2.4} />
          </button>
          <label className="mdocs-sheet-style-label" title={t("sheetFontSize")}>
            <select
              className="mdocs-sheet-font-size"
              disabled={!props.canEdit || selection.length === 0}
              value={sampleStyle?.fontSize ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                applyStylePatch(v ? { fontSize: Number(v) } : { fontSize: undefined });
              }}
            >
              <option value="">Aa</option>
              {[12, 13, 14, 16, 18, 20, 24].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="mdocs-sheet-style-label" title={t("sheetTextColor")}>
            <input
              type="color"
              className="mdocs-sheet-color"
              disabled={!props.canEdit || selection.length === 0}
              value={sampleStyle?.color ?? "#212121"}
              onChange={(e) => applyStylePatch({ color: e.target.value })}
            />
          </label>
          <label className="mdocs-sheet-style-label" title={t("sheetBgColor")}>
            <input
              type="color"
              className="mdocs-sheet-color"
              disabled={!props.canEdit || selection.length === 0}
              value={sampleStyle?.bg ?? "#ffffff"}
              onChange={(e) => applyStylePatch({ bg: e.target.value })}
            />
          </label>
          <span className="mdocs-sheet-toolbar-sep" aria-hidden />
          <button
            type="button"
            className="mdocs-sheet-btn"
            disabled={!props.canEdit || selection.length < 2}
            title={`${t("sheetMerge")}（按住拖选，或 Shift+点第二格）`}
            onClick={doMerge}
          >
            <Merge size={13} strokeWidth={2.2} />
            <span>{t("sheetMerge")}</span>
          </button>
          <button
            type="button"
            className="mdocs-sheet-btn"
            disabled={
              !props.canEdit ||
              !focus ||
              !findMergeAt(activeTab, focus.rowId, focus.colId)
            }
            title={t("sheetUnmerge")}
            onClick={doUnmerge}
          >
            <SplitSquareHorizontal size={13} strokeWidth={2.2} />
            <span>{t("sheetUnmerge")}</span>
          </button>
        </div>
        <div className="mdocs-sheet-toolbar-right">
          <span className="mdocs-sheet-stats-badge">
            {activeTab.name} · {activeTab.rows.length} 行 × {activeTab.columns.length} 列
          </span>
        </div>
      </div>

      <div className="mdocs-sheet-scroll">
        <table className="mdocs-sheet-table">
          <thead>
            <tr>
              <th
                className="mdocs-sheet-corner-cell"
                title="全选"
                onMouseDown={selectAllCells}
              >
                #
              </th>
              {activeTab.columns.map((col) => {
                const colSelected =
                  selection.length > 0 &&
                  activeTab.rows.every((r) =>
                    selectedKeys.has(cellKey({ rowId: r.id, colId: col.id })),
                  );
                return (
                  <th
                    key={col.id}
                    className={`mdocs-sheet-th${colSelected ? " is-selected" : ""}`}
                    onMouseDown={(e) => {
                      if (renamingColId === col.id) return;
                      if ((e.target as HTMLElement).closest(".mdocs-sheet-col-del")) return;
                      selectEntireColumn(col.id, e.shiftKey, e);
                    }}
                  >
                    <div className="mdocs-sheet-header-cell">
                      {renamingColId === col.id && props.canEdit ? (
                        <input
                          className="mdocs-sheet-header-input"
                          autoFocus
                          defaultValue={col.name}
                          title="编辑列名"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            setRenamingColId(null);
                            const next = e.target.value.trim();
                            if (!next || next === col.name) return;
                            mutateTab(setSheetColumnName(activeTab, col.id, next));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setRenamingColId(null);
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="mdocs-sheet-header-label"
                          title="单击全选列；双击重命名"
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (props.canEdit) setRenamingColId(col.id);
                          }}
                        >
                          {col.name}
                        </button>
                      )}
                      {props.canEdit && activeTab.columns.length > 1 && (
                        <button
                          type="button"
                          className="mdocs-sheet-col-del"
                          title={t("sheetDeleteColumn")}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            try {
                              const { tab: next } = removeSheetColumns(activeTab, [col.id]);
                              mutateTab(next);
                            } catch {
                              /* keep last column */
                            }
                          }}
                        >
                          <Trash2 size={12} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="mdocs-sheet-actions-header" />
            </tr>
          </thead>
          <tbody>
            {activeTab.rows.map((row, idx) => {
              const rowSelected =
                selection.length > 0 &&
                activeTab.columns.every((c) =>
                  selectedKeys.has(cellKey({ rowId: row.id, colId: c.id })),
                );
              return (
              <tr key={row.id} className={`mdocs-sheet-tr${rowSelected ? " is-row-selected" : ""}`}>
                <td
                  className={`mdocs-sheet-rownum${rowSelected ? " is-selected" : ""}`}
                  title="单击全选行"
                  onMouseDown={(e) => selectEntireRow(row.id, e.shiftKey, e)}
                >
                  {idx + 1}
                </td>
                {activeTab.columns.map((col) => {
                  if (isCoveredCell(activeTab, row.id, col.id)) return null;
                  const cell = row.cells[col.id];
                  const style = getCellStyle(cell);
                  const merge = findMergeAt(activeTab, row.id, col.id);
                  const master = isMergeMaster(activeTab, row.id, col.id);
                  const span =
                    merge && master ? mergeSpan(activeTab, merge) : { rowSpan: 1, colSpan: 1 };
                  const ref = { rowId: row.id, colId: col.id };
                  const selected = selectedKeys.has(cellKey(ref));
                  return (
                    <td
                      key={col.id}
                      className={`mdocs-sheet-td${selected ? " is-selected" : ""}`}
                      rowSpan={span.rowSpan > 1 ? span.rowSpan : undefined}
                      colSpan={span.colSpan > 1 ? span.colSpan : undefined}
                      style={style?.bg ? { background: style.bg } : undefined}
                      onMouseEnter={() => extendCellSelect(ref)}
                    >
                      <input
                        className="mdocs-sheet-cell-input"
                        style={cellInputStyle(style)}
                        value={getCellValue(cell)}
                        disabled={!props.canEdit}
                        onMouseDown={(e) => beginCellSelect(ref, e.shiftKey, e)}
                        onFocus={() => {
                          // 键盘 Tab 进格时同步单格选区
                          if (!draggingSelectRef.current) {
                            setAnchor(ref);
                            setFocus(ref);
                            anchorRef.current = ref;
                          }
                        }}
                        onChange={(e) =>
                          mutateTab(
                            setSheetCell(activeTab, row.id, col.id, e.target.value),
                          )
                        }
                      />
                    </td>
                  );
                })}
                <td className="mdocs-sheet-actions-col">
                  <button
                    type="button"
                    className="mdocs-sheet-row-del"
                    disabled={!props.canEdit}
                    title={t("sheetDeleteRow")}
                    onClick={() => mutateTab(removeSheetRow(activeTab, row.id))}
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="mdocs-sheet-footer">
        <div className="mdocs-sheet-tabs" role="tablist">
          {workbook.sheets.map((tab) => {
            const active = tab.id === activeTab.id;
            return (
              <div
                key={tab.id}
                className={`mdocs-sheet-tab${active ? " mdocs-sheet-tab--active" : ""}`}
                role="tab"
                aria-selected={active}
              >
                {renamingTabId === tab.id && props.canEdit ? (
                  <input
                    className="mdocs-sheet-tab-rename"
                    autoFocus
                    defaultValue={tab.name}
                    onBlur={(e) => {
                      setRenamingTabId(null);
                      const next = e.target.value.trim();
                      if (!next || next === tab.name) return;
                      try {
                        mutateWorkbook(renameWorkbookSheet(workbook, tab.id, next));
                      } catch {
                        /* duplicate name */
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenamingTabId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="mdocs-sheet-tab-btn"
                    title="双击可重命名工作表"
                    onClick={() => {
                      if (active) return;
                      const next = setActiveSheet(workbook, tab.id);
                      setWorkbook(next);
                      setAnchor(null);
                      setFocus(null);
                      if (props.canEdit) {
                        props.onContentChange?.(serializeSheetDocument(next));
                        scheduleSave();
                      }
                    }}
                    onDoubleClick={() => {
                      if (props.canEdit) setRenamingTabId(tab.id);
                    }}
                  >
                    {tab.name}
                  </button>
                )}
                {props.canEdit && workbook.sheets.length > 1 ? (
                  <button
                    type="button"
                    className="mdocs-sheet-tab-close"
                    title={t("sheetDeleteSheet")}
                    onClick={(e) => {
                      e.stopPropagation();
                      try {
                        mutateWorkbook(removeWorkbookSheet(workbook, tab.id));
                      } catch {
                        /* last sheet */
                      }
                    }}
                  >
                    <X size={11} strokeWidth={2.4} />
                  </button>
                ) : null}
              </div>
            );
          })}
          <button
            type="button"
            className="mdocs-sheet-tab-add"
            disabled={!props.canEdit}
            title={t("sheetAddSheet")}
            onClick={() => {
              const { doc } = addWorkbookSheet(workbook);
              mutateWorkbook(doc);
            }}
          >
            <Plus size={13} strokeWidth={2.2} />
          </button>
        </div>
        <div className="mdocs-sheet-footer-info">
          <span>共 {workbook.sheets.length} 个工作表</span>
        </div>
      </footer>
    </div>
  );
}
