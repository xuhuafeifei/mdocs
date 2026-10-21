/**
 * SheetEditor — `.sheet` 工作簿 + DocChrome。
 * 支持单元格样式（底色/字色/粗斜体/字号）与合并单元格。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Bold,
  Columns3,
  Italic,
  Merge,
  Plus,
  Rows3,
  ShieldUser,
  SplitSquareHorizontal,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { ActiveDocumentMeta } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import {
  DocumentPermission,
  allowedPermissionsForDomain,
  type DocumentPermissionValue,
} from "../../shared/permissions.js";
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
import { localizeDomainName } from "./utils";
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
  addDocumentInviteApi,
  checkBookmarkApi,
  fetchVisitorsDirectoryApi,
  getDocumentInvitesApi,
  removeBookmarkApi,
  removeDocumentInviteApi,
} from "../services/endpoints";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";
import { VisitorPickerModal } from "./VisitorPickerModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { useDocScrollCache } from "./hooks/useDocScrollCache";
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
  canManageInvites?: boolean;
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

/** 0 → A, 25 → Z, 26 → AA …（Excel 列标） */
function colIndexToLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellAddress(tab: SheetTab, ref: CellRef): string {
  const ci = tab.columns.findIndex((c) => c.id === ref.colId);
  const ri = tab.rows.findIndex((r) => r.id === ref.rowId);
  if (ci < 0 || ri < 0) return "";
  return `${colIndexToLetter(ci)}${ri + 1}`;
}

/**
 * 公式栏锚定格：整行 → 该行首列；整列 → 该列首行；否则用焦点格。
 */
function resolveFormulaBarRef(
  tab: SheetTab,
  anchor: CellRef | null,
  focus: CellRef | null,
  selectedKeys: Set<string>,
): CellRef | null {
  if (!anchor || !focus || selectedKeys.size === 0) return null;
  const entireRow =
    anchor.rowId === focus.rowId &&
    tab.columns.length > 0 &&
    tab.columns.every((c) =>
      selectedKeys.has(cellKey({ rowId: anchor.rowId, colId: c.id })),
    );
  if (entireRow) {
    return { rowId: anchor.rowId, colId: tab.columns[0]!.id };
  }
  const entireCol =
    anchor.colId === focus.colId &&
    tab.rows.length > 0 &&
    tab.rows.every((r) =>
      selectedKeys.has(cellKey({ rowId: r.id, colId: anchor.colId })),
    );
  if (entireCol) {
    return { rowId: tab.rows[0]!.id, colId: anchor.colId };
  }
  return focus;
}

/** 选区外轮廓：只在选区边缘画线，避免每格粗框叠成「梯子」 */
function selectionCellClassName(
  tab: SheetTab,
  ref: CellRef,
  selectedKeys: Set<string>,
  focus: CellRef | null,
): string {
  if (!selectedKeys.has(cellKey(ref))) return "mdocs-sheet-td";
  const ri = tab.rows.findIndex((r) => r.id === ref.rowId);
  const ci = tab.columns.findIndex((c) => c.id === ref.colId);
  const parts = ["mdocs-sheet-td", "is-selected"];
  if (focus && focus.rowId === ref.rowId && focus.colId === ref.colId) {
    parts.push("is-active");
  }
  if (ri < 0 || ci < 0) return parts.join(" ");
  const up =
    ri > 0 ? cellKey({ rowId: tab.rows[ri - 1]!.id, colId: ref.colId }) : null;
  const down =
    ri < tab.rows.length - 1
      ? cellKey({ rowId: tab.rows[ri + 1]!.id, colId: ref.colId })
      : null;
  const left =
    ci > 0 ? cellKey({ rowId: ref.rowId, colId: tab.columns[ci - 1]!.id }) : null;
  const right =
    ci < tab.columns.length - 1
      ? cellKey({ rowId: ref.rowId, colId: tab.columns[ci + 1]!.id })
      : null;
  if (!up || !selectedKeys.has(up)) parts.push("sel-t");
  if (!down || !selectedKeys.has(down)) parts.push("sel-b");
  if (!left || !selectedKeys.has(left)) parts.push("sel-l");
  if (!right || !selectedKeys.has(right)) parts.push("sel-r");
  return parts.join(" ");
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
  const { t, lang } = useI18n();
  const documentId = props.meta.documentId;

  const [workbook, setWorkbook] = useState<SheetDocument>(() =>
    parseSheetDocument(props.initialContent),
  );
  const [displayName, setDisplayName] = useState(props.initialDisplayName);
  const [busy, setBusy] = useState(false);
  const [draftExists, setDraftExists] = useState(props.hasLocalDraft ?? false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [showDocInfoMenu, setShowDocInfoMenu] = useState(false);
  const [showReaderMoreMenu, setShowReaderMoreMenu] = useState(false);
  const [visitors, setVisitors] = useState<VisitorDirectoryEntry[]>([]);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionDraft, setPermissionDraft] = useState<DocumentPermissionValue>(
    props.meta.permission as DocumentPermissionValue,
  );
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [existingInvites, setExistingInvites] = useState<Map<string, string>>(new Map());
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [deleteTabTarget, setDeleteTabTarget] = useState<{ id: string; name: string } | null>(null);
  const [renamingColId, setRenamingColId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<CellRef | null>(null);
  const [focus, setFocus] = useState<CellRef | null>(null);
  const [formulaDraft, setFormulaDraft] = useState("");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingSelectRef = useRef(false);
  const anchorRef = useRef<CellRef | null>(null);
  const workbookRef = useRef(workbook);
  const displayNameRef = useRef(displayName);
  const docInfoMenuRef = useRef<HTMLDivElement>(null);
  const readerMoreMenuRef = useRef<HTMLDivElement>(null);
  const scrollHostRef = useRef<HTMLDivElement | null>(null);
  workbookRef.current = workbook;
  displayNameRef.current = displayName;
  anchorRef.current = anchor;

  useDocScrollCache(documentId, scrollHostRef, true);

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
  const formulaRef = resolveFormulaBarRef(activeTab, anchor, focus, selectedKeys);
  const formulaAddress = formulaRef ? cellAddress(activeTab, formulaRef) : "";
  const formulaLiveValue = formulaRef
    ? getCellValue(
        activeTab.rows.find((r) => r.id === formulaRef.rowId)?.cells[formulaRef.colId],
      )
    : "";

  useEffect(() => {
    setFormulaDraft(formulaLiveValue);
  }, [formulaLiveValue, formulaRef?.rowId, formulaRef?.colId]);

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

  useEffect(() => {
    let mounted = true;
    fetchVisitorsDirectoryApi()
      .then((data) => {
        if (mounted) setVisitors(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPermissionDraft(props.meta.permission as DocumentPermissionValue);
  }, [props.meta.permission, documentId]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (docInfoMenuRef.current && !docInfoMenuRef.current.contains(event.target as Node)) {
        setShowDocInfoMenu(false);
      }
      if (readerMoreMenuRef.current && !readerMoreMenuRef.current.contains(event.target as Node)) {
        setShowReaderMoreMenu(false);
      }
    };
    if (showDocInfoMenu || showReaderMoreMenu) {
      document.addEventListener("mousedown", onDown);
    }
    return () => document.removeEventListener("mousedown", onDown);
  }, [showDocInfoMenu, showReaderMoreMenu]);

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

  function getVisitorName(visitorId: string): string {
    const v = visitors.find((x) => x.visitorId === visitorId);
    return v?.visitorName ?? visitorId.slice(0, 8);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const currentDomain = useMemo(
    () => props.domains.find((d) => d.domainId === props.meta.domainId),
    [props.domains, props.meta.domainId],
  );

  const allowedPermissions = useMemo<DocumentPermissionValue[]>(() => {
    const domainPermission = currentDomain?.permission ?? "public";
    return allowedPermissionsForDomain(domainPermission);
  }, [currentDomain?.permission]);

  function permissionLabel(permission: DocumentPermissionValue): string {
    if (permission === DocumentPermission.PRIVATE) return t("permissionPrivate");
    if (permission === DocumentPermission.DOMAIN_READ) return t("permissionInvite");
    if (permission === DocumentPermission.DOMAIN_WRITE) return t("permissionDomainWrite");
    if (permission === DocumentPermission.PUBLIC_READ) return t("permissionPublicRead");
    return t("permissionPublicEdit");
  }

  async function savePermission(): Promise<void> {
    if (permissionBusy || permissionDraft === props.meta.permission) {
      setShowPermissionDialog(false);
      return;
    }
    setPermissionBusy(true);
    try {
      await props.onPublish(
        serializeSheetDocument(workbookRef.current),
        displayNameRef.current.trim() || displayName,
        documentId,
        permissionDraft,
      );
      setShowPermissionDialog(false);
    } finally {
      setPermissionBusy(false);
    }
  }

  async function saveInvite(
    result: Array<{ visitorId: string; permission: string }>,
  ): Promise<void> {
    const nextIds = new Set(result.map((r) => r.visitorId));
    for (const [vid] of existingInvites) {
      if (!nextIds.has(vid)) {
        await removeDocumentInviteApi(documentId, vid);
      }
    }
    for (const row of result) {
      const prev = existingInvites.get(row.visitorId);
      if (prev !== row.permission) {
        await addDocumentInviteApi(documentId, row.visitorId, row.permission);
      }
    }
    setShowInvitePicker(false);
  }

  function closeMenus(): void {
    setShowDocInfoMenu(false);
    setShowReaderMoreMenu(false);
  }

  function renderDocInfoMenuPanel(onClose: () => void, options?: { includeBookmark?: boolean }) {
    const includeBookmark = options?.includeBookmark ?? true;
    const menuItemStyle = {
      width: "100%",
      textAlign: "left" as const,
      padding: "8px 16px",
      background: "none",
      border: "none",
      cursor: "pointer" as const,
      fontSize: "13px",
      display: "flex",
      alignItems: "center" as const,
      gap: "8px",
    };
    const serialized = serializeSheetDocument(workbook);
    return (
      <>
        <div style={{ padding: "4px 16px", fontSize: "13px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoCreator")}</span>
            <span>{getVisitorName(props.meta.ownerVisitorId)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoCreatedAt")}</span>
            <span>{new Date(props.meta.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoSize")}</span>
            <span>{formatFileSize(new Blob([serialized]).size)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoUpdatedAt")}</span>
            <span>{new Date(props.meta.updatedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
          </div>
        </div>
        <div style={{ height: "1px", background: "var(--mdocs-border, #e5e5e5)", margin: "8px 0" }} />
        {includeBookmark ? (
          <button
            type="button"
            style={menuItemStyle}
            onClick={() => {
              void toggleBookmark();
              onClose();
            }}
          >
            <span>{isBookmarked ? "⭐" : "☆"}</span>
            <span>{isBookmarked ? t("bookmarkRemove") : t("bookmarkAdd")}</span>
          </button>
        ) : null}
        {props.canManageInvites ? (
          <button
            type="button"
            style={menuItemStyle}
            onClick={() => {
              onClose();
              void (async () => {
                const invites = await getDocumentInvitesApi(documentId);
                setExistingInvites(new Map(invites.map((i) => [i.visitorId, i.permission])));
                setShowInvitePicker(true);
              })();
            }}
          >
            <Users size={14} />
            <span>{t("docInfoInviteMember")}</span>
          </button>
        ) : null}
        <button
          type="button"
          style={menuItemStyle}
          onClick={() => {
            onClose();
            setPermissionDraft(props.meta.permission as DocumentPermissionValue);
            setShowPermissionDialog(true);
          }}
        >
          <ShieldUser size={14} />
          <span>{t("docInfoChangePermission")}</span>
        </button>
      </>
    );
  }

  const sampleStyle = (() => {
    const sample = selection[0];
    if (!sample) return undefined;
    return getCellStyle(
      activeTab.rows.find((r) => r.id === sample.rowId)?.cells[sample.colId],
    );
  })();

  function commitFormulaDraft(): void {
    if (!props.canEdit || !formulaRef) return;
    if (formulaDraft === formulaLiveValue) return;
    mutateTab(setSheetCell(activeTab, formulaRef.rowId, formulaRef.colId, formulaDraft));
  }

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
        docInfoMenu={renderDocInfoMenuPanel(closeMenus)}
        docInfoOpen={showDocInfoMenu}
        onToggleDocInfo={() => setShowDocInfoMenu(!showDocInfoMenu)}
        docInfoMenuRef={docInfoMenuRef}
        readerChrome={props.readerChrome}
        readerHeaderDocked={Boolean(props.readerChrome)}
        onOpenMobileNav={props.onOpenMobileNav}
        readerMoreOpen={showReaderMoreMenu}
        onToggleReaderMore={() => setShowReaderMoreMenu((o) => !o)}
        readerMoreMenuRef={readerMoreMenuRef}
        readerMoreMenu={
          <>
            <button
              type="button"
              className="mdocs-reader-more-item"
              disabled={bookmarkBusy}
              onClick={() => {
                void toggleBookmark();
                closeMenus();
              }}
            >
              <Star
                size={16}
                strokeWidth={1.5}
                style={{
                  color: isBookmarked ? "#faad14" : "var(--mdocs-text-secondary, #6b7280)",
                  fill: isBookmarked ? "#faad14" : "none",
                }}
              />
              <span>{isBookmarked ? t("bookmarkRemove") : t("bookmarkAdd")}</span>
            </button>
            <div className="mdocs-reader-more-divider" />
            {props.canEdit ? (
              <button
                type="button"
                className="mdocs-reader-more-item mdocs-reader-more-item--danger"
                disabled={busy}
                onClick={() => {
                  closeMenus();
                  void props.onDelete();
                }}
              >
                <span>{t("delete")}</span>
              </button>
            ) : null}
            <div className="mdocs-reader-more-divider" />
            {renderDocInfoMenuPanel(closeMenus, { includeBookmark: false })}
          </>
        }
      />

      <div className="mdocs-sheet-toolbar">
        <div className="mdocs-sheet-toolbar-left">
          <button
            type="button"
            className="mdocs-sheet-btn mdocs-sheet-btn-add"
            disabled={!props.canEdit}
            onClick={() => mutateTab(addSheetRow(activeTab))}
          >
            <span className="mdocs-sheet-btn-add-icon" aria-hidden>
              <Rows3 size={14} strokeWidth={2.4} />
              <Plus size={10} strokeWidth={3} className="mdocs-sheet-btn-add-plus" />
            </span>
            <span>{t("sheetAddRow")}</span>
          </button>
          <button
            type="button"
            className="mdocs-sheet-btn mdocs-sheet-btn-add"
            disabled={!props.canEdit}
            onClick={() => mutateTab(addSheetColumn(activeTab))}
          >
            <span className="mdocs-sheet-btn-add-icon" aria-hidden>
              <Columns3 size={14} strokeWidth={2.4} />
              <Plus size={10} strokeWidth={3} className="mdocs-sheet-btn-add-plus" />
            </span>
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

      <div className="mdocs-sheet-formula-bar" aria-label="单元格信息栏">
        <div className="mdocs-sheet-formula-bar-inner">
          <input
            className="mdocs-sheet-name-box"
            readOnly
            tabIndex={-1}
            value={formulaAddress}
            placeholder="—"
            title={formulaAddress || "单元格地址"}
            aria-label="单元格地址"
          />
          <input
            className="mdocs-sheet-formula-input"
            value={formulaDraft}
            disabled={!props.canEdit || !formulaRef}
            placeholder={formulaRef ? "" : "点击单元格查看内容"}
            title={formulaDraft}
            aria-label="单元格内容"
            style={
              props.readerChrome
                ? {
                    width: `${Math.max(28, Math.min((formulaDraft || " ").length + 4, 96))}ch`,
                  }
                : undefined
            }
            onChange={(e) => setFormulaDraft(e.target.value)}
            onBlur={() => commitFormulaDraft()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                setFormulaDraft(formulaLiveValue);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>
      </div>

      <div className="mdocs-sheet-scroll" ref={scrollHostRef}>
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
                      className={selectionCellClassName(
                        activeTab,
                        ref,
                        selectedKeys,
                        focus,
                      )}
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
                      setDeleteTabTarget({ id: tab.id, name: tab.name });
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
            <Plus size={14} strokeWidth={2.4} />
            <span>{t("sheetAddSheet")}</span>
          </button>
        </div>
        <div className="mdocs-sheet-footer-info">
          <span>共 {workbook.sheets.length} 个工作表</span>
        </div>
      </footer>

      {deleteTabTarget ? (
        <ConfirmDialog
          title={t("sheetDeleteSheet")}
          message={`确定删除工作表「${deleteTabTarget.name}」？其中的数据将一并删除。`}
          confirmLabel={t("delete")}
          cancelLabel={t("cancel")}
          danger
          onCancel={() => setDeleteTabTarget(null)}
          onConfirm={() => {
            try {
              mutateWorkbook(removeWorkbookSheet(workbook, deleteTabTarget.id));
            } finally {
              setDeleteTabTarget(null);
            }
          }}
        />
      ) : null}

      {showPermissionDialog && (
        <div
          className="mdocs-dialog-backdrop"
          style={{ position: "fixed", zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPermissionDialog(false);
          }}
        >
          <div className="mdocs-dialog card" style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: "1.1rem", marginBottom: 12 }}>{t("docInfoChangePermission")}</h1>
            <div className="muted" style={{ marginBottom: 12 }}>
              {t("domainPermission")}：
              {currentDomain
                ? localizeDomainName(currentDomain.domainName, lang, t)
                : props.meta.domainId}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {allowedPermissions.map((permission) => (
                <label
                  key={permission}
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name="sheet-doc-permission"
                    value={permission}
                    checked={permissionDraft === permission}
                    onChange={() => setPermissionDraft(permission)}
                  />
                  <span>{permissionLabel(permission)}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowPermissionDialog(false)}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={permissionBusy}
                onClick={() => void savePermission()}
              >
                {permissionBusy ? t("publishing") : t("saveAndPublish")}
              </button>
            </div>
          </div>
        </div>
      )}

      {props.canManageInvites ? (
        <VisitorPickerModal
          open={showInvitePicker}
          title={t("docInfoInviteMember")}
          initialSelectedIds={[...existingInvites.keys()]}
          initialPermissions={existingInvites}
          templates={[]}
          showPermissionSelect={true}
          permissionOptions={[
            { value: "read", label: t("invitePermissionRead") },
            { value: "edit", label: t("invitePermissionEdit") },
          ]}
          onClose={() => setShowInvitePicker(false)}
          onConfirm={(result) => {
            void saveInvite(result as Array<{ visitorId: string; permission: string }>);
          }}
        />
      ) : null}
    </div>
  );
}
