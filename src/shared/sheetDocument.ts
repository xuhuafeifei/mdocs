/**
 * `.sheet` 工作簿：一个文件内多个工作表（tabs）。
 * 磁盘 JSON；每表行列有稳定 id，供 Agent patch。
 * 可选 merges + per-cell style（底色/字色/粗斜体/字号）。
 */

export const SHEET_FORMAT_VERSION = 2 as const;

export interface SheetColumn {
  id: string;
  name: string;
}

/** 单元格样式（仅非默认字段写出） */
export interface SheetCellStyle {
  bg?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
}

/** 内存中的单元格：值 + 可选样式 */
export interface SheetCell {
  v: string;
  style?: SheetCellStyle;
}

export interface SheetRow {
  id: string;
  /** columnId → cell */
  cells: Record<string, SheetCell>;
}

/** 合并区：闭区间，主格 = 左上角 (startRowId, startColId) */
export interface SheetMerge {
  startRowId: string;
  startColId: string;
  endRowId: string;
  endColId: string;
}

/** 单个工作表（标签页） */
export interface SheetTab {
  id: string;
  name: string;
  columns: SheetColumn[];
  rows: SheetRow[];
  merges?: SheetMerge[];
}

/** 整份 `.sheet` 文档 = 工作簿 */
export interface SheetDocument {
  version: typeof SHEET_FORMAT_VERSION;
  sheets: SheetTab[];
  activeSheetId: string;
}

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptySheetCell(v = ""): SheetCell {
  return { v };
}

export function getCellValue(cell: SheetCell | string | undefined | null): string {
  if (cell == null) return "";
  if (typeof cell === "string") return cell;
  return cell.v ?? "";
}

export function getCellStyle(cell: SheetCell | string | undefined | null): SheetCellStyle | undefined {
  if (cell == null || typeof cell === "string") return undefined;
  return cell.style;
}

export function parseCellRaw(raw: unknown): SheetCell {
  if (typeof raw === "string") return { v: raw };
  if (raw == null) return { v: "" };
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const v =
      typeof o.v === "string" ? o.v : o.v == null ? "" : String(o.v);
    const style = normalizeStyle(o.style);
    return style ? { v, style } : { v };
  }
  return { v: String(raw) };
}

export function isValidSheetColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}

export function normalizeStyle(raw: unknown): SheetCellStyle | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const style: SheetCellStyle = {};
  if (typeof o.bg === "string" && o.bg.trim()) {
    const bg = o.bg.trim();
    if (isValidSheetColor(bg)) style.bg = bg;
  }
  if (typeof o.color === "string" && o.color.trim()) {
    const color = o.color.trim();
    if (isValidSheetColor(color)) style.color = color;
  }
  if (o.bold === true) style.bold = true;
  if (o.italic === true) style.italic = true;
  if (typeof o.fontSize === "number" && Number.isFinite(o.fontSize)) {
    const n = Math.round(o.fontSize);
    if (n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX) style.fontSize = n;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

/** patch 合并进现有 style；传 null 清除 */
export function mergeCellStyle(
  current: SheetCellStyle | undefined,
  patch: SheetCellStyle | null | undefined,
): SheetCellStyle | undefined {
  if (patch === null) return undefined;
  if (patch == null) return current;
  const next: SheetCellStyle = { ...(current ?? {}) };
  if ("bg" in patch) {
    if (patch.bg == null || patch.bg === "") delete next.bg;
    else if (isValidSheetColor(patch.bg)) next.bg = patch.bg.trim();
  }
  if ("color" in patch) {
    if (patch.color == null || patch.color === "") delete next.color;
    else if (isValidSheetColor(patch.color)) next.color = patch.color.trim();
  }
  if ("bold" in patch) {
    if (patch.bold) next.bold = true;
    else delete next.bold;
  }
  if ("italic" in patch) {
    if (patch.italic) next.italic = true;
    else delete next.italic;
  }
  if ("fontSize" in patch) {
    if (patch.fontSize == null) delete next.fontSize;
    else {
      const n = Math.round(Number(patch.fontSize));
      if (n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX) next.fontSize = n;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function compactCellForDisk(cell: SheetCell): string | SheetCell {
  const style = normalizeStyle(cell.style);
  if (!style) return cell.v;
  return { v: cell.v, style };
}

function compactTabForDisk(tab: SheetTab): Record<string, unknown> {
  const merges = (tab.merges ?? []).filter(Boolean);
  return {
    id: tab.id,
    name: tab.name,
    columns: tab.columns,
    rows: tab.rows.map((r) => ({
      id: r.id,
      cells: Object.fromEntries(
        Object.entries(r.cells).map(([k, cell]) => [k, compactCellForDisk(cell)]),
      ),
    })),
    ...(merges.length > 0 ? { merges } : {}),
  };
}

function createEmptyTab(opts?: {
  name?: string;
  columnCount?: number;
  rowCount?: number;
}): SheetTab {
  const columnCount = Math.max(1, opts?.columnCount ?? 3);
  const rowCount = Math.max(0, opts?.rowCount ?? 5);
  const columns: SheetColumn[] = [];
  for (let i = 0; i < columnCount; i += 1) {
    columns.push({ id: newId("c"), name: `列${i + 1}` });
  }
  const rows: SheetRow[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    const cells: Record<string, SheetCell> = {};
    for (const col of columns) cells[col.id] = emptySheetCell();
    rows.push({ id: newId("r"), cells });
  }
  return {
    id: newId("s"),
    name: opts?.name?.trim() || "Sheet1",
    columns,
    rows,
    merges: [],
  };
}

export function createEmptySheetDocument(opts?: {
  columnCount?: number;
  rowCount?: number;
}): SheetDocument {
  const tab = createEmptyTab(opts);
  return {
    version: SHEET_FORMAT_VERSION,
    sheets: [tab],
    activeSheetId: tab.id,
  };
}

export function serializeSheetDocument(doc: SheetDocument): string {
  const payload = {
    version: SHEET_FORMAT_VERSION,
    activeSheetId: doc.activeSheetId,
    sheets: doc.sheets.map(compactTabForDisk),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function parseMerges(raw: unknown, tab: { columns: SheetColumn[]; rows: SheetRow[] }): SheetMerge[] {
  if (!Array.isArray(raw)) return [];
  const rowIds = new Set(tab.rows.map((r) => r.id));
  const colIds = new Set(tab.columns.map((c) => c.id));
  const out: SheetMerge[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const startRowId = typeof o.startRowId === "string" ? o.startRowId : "";
    const startColId = typeof o.startColId === "string" ? o.startColId : "";
    const endRowId = typeof o.endRowId === "string" ? o.endRowId : "";
    const endColId = typeof o.endColId === "string" ? o.endColId : "";
    if (!rowIds.has(startRowId) || !rowIds.has(endRowId)) continue;
    if (!colIds.has(startColId) || !colIds.has(endColId)) continue;
    out.push({ startRowId, startColId, endRowId, endColId });
  }
  return out;
}

function parseTab(raw: unknown, fallbackName: string): SheetTab | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const columnsIn = Array.isArray(obj.columns) ? obj.columns : [];
  const rowsIn = Array.isArray(obj.rows) ? obj.rows : [];
  const columns: SheetColumn[] = [];
  for (const c of columnsIn) {
    if (!c || typeof c !== "object") continue;
    const col = c as Record<string, unknown>;
    const id = typeof col.id === "string" && col.id ? col.id : newId("c");
    const name = typeof col.name === "string" ? col.name : id;
    columns.push({ id, name });
  }
  if (columns.length === 0) return null;
  const rows: SheetRow[] = [];
  for (const r of rowsIn) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id ? row.id : newId("r");
    const cellsRaw =
      row.cells && typeof row.cells === "object" && !Array.isArray(row.cells)
        ? (row.cells as Record<string, unknown>)
        : {};
    const cells: Record<string, SheetCell> = {};
    for (const col of columns) {
      cells[col.id] = parseCellRaw(cellsRaw[col.id]);
    }
    rows.push({ id, cells });
  }
  const id = typeof obj.id === "string" && obj.id ? obj.id : newId("s");
  const name =
    typeof obj.name === "string" && obj.name.trim()
      ? obj.name.trim()
      : fallbackName;
  const merges = parseMerges(obj.merges, { columns, rows });
  return { id, name, columns, rows, merges };
}

/** 兼容 v1：顶层 columns/rows → 单表工作簿。 */
export function parseSheetDocument(raw: string): SheetDocument {
  const trimmed = raw.trim();
  if (!trimmed) return createEmptySheetDocument();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return createEmptySheetDocument();
  }
  if (!parsed || typeof parsed !== "object") return createEmptySheetDocument();
  const obj = parsed as Record<string, unknown>;

  if (Array.isArray(obj.sheets) && obj.sheets.length > 0) {
    const sheets: SheetTab[] = [];
    for (let i = 0; i < obj.sheets.length; i += 1) {
      const tab = parseTab(obj.sheets[i], `Sheet${i + 1}`);
      if (tab) sheets.push(tab);
    }
    if (sheets.length === 0) return createEmptySheetDocument();
    const activeRaw =
      typeof obj.activeSheetId === "string" ? obj.activeSheetId : "";
    const activeSheetId = sheets.some((s) => s.id === activeRaw)
      ? activeRaw
      : sheets[0]!.id;
    return { version: SHEET_FORMAT_VERSION, sheets, activeSheetId };
  }

  const tab = parseTab(obj, "Sheet1");
  if (!tab) return createEmptySheetDocument();
  return {
    version: SHEET_FORMAT_VERSION,
    sheets: [tab],
    activeSheetId: tab.id,
  };
}

export function resolveSheetTab(
  doc: SheetDocument,
  sheet?: string,
): SheetTab | null {
  const key = sheet?.trim();
  if (!key) {
    return doc.sheets.find((s) => s.id === doc.activeSheetId) ?? doc.sheets[0] ?? null;
  }
  const byId = doc.sheets.find((s) => s.id === key);
  if (byId) return byId;
  const byName = doc.sheets.find((s) => s.name === key);
  if (byName) return byName;
  const lower = key.toLowerCase();
  return doc.sheets.find((s) => s.name.toLowerCase() === lower) ?? null;
}

export function replaceSheetTab(doc: SheetDocument, tab: SheetTab): SheetDocument {
  if (!doc.sheets.some((s) => s.id === tab.id)) {
    throw new Error(`unknown sheet: ${tab.id}`);
  }
  return {
    ...doc,
    sheets: doc.sheets.map((s) => (s.id === tab.id ? tab : s)),
  };
}

export function setActiveSheet(
  doc: SheetDocument,
  sheet: string,
): SheetDocument {
  const tab = resolveSheetTab(doc, sheet);
  if (!tab) throw new Error(`unknown sheet: ${sheet}`);
  return { ...doc, activeSheetId: tab.id };
}

export function addWorkbookSheet(
  doc: SheetDocument,
  name?: string,
): { doc: SheetDocument; tab: SheetTab } {
  let base = (name?.trim() || `Sheet${doc.sheets.length + 1}`);
  const existing = new Set(doc.sheets.map((s) => s.name));
  if (existing.has(base)) {
    let n = 2;
    while (existing.has(`${base}${n}`)) n += 1;
    base = `${base}${n}`;
  }
  const tab = createEmptyTab({ name: base });
  return {
    doc: {
      ...doc,
      sheets: [...doc.sheets, tab],
      activeSheetId: tab.id,
    },
    tab,
  };
}

export function renameWorkbookSheet(
  doc: SheetDocument,
  sheet: string,
  name: string,
): SheetDocument {
  const tab = resolveSheetTab(doc, sheet);
  if (!tab) throw new Error(`unknown sheet: ${sheet}`);
  const nextName = name.trim();
  if (!nextName) throw new Error("sheet name is required");
  const clash = doc.sheets.find((s) => s.id !== tab.id && s.name === nextName);
  if (clash) throw new Error(`sheet name already exists: ${nextName}`);
  return replaceSheetTab(doc, { ...tab, name: nextName });
}

export function removeWorkbookSheet(
  doc: SheetDocument,
  sheet: string,
): SheetDocument {
  const tab = resolveSheetTab(doc, sheet);
  if (!tab) throw new Error(`unknown sheet: ${sheet}`);
  if (doc.sheets.length <= 1) {
    throw new Error("cannot delete the last sheet");
  }
  const sheets = doc.sheets.filter((s) => s.id !== tab.id);
  const activeSheetId =
    doc.activeSheetId === tab.id ? sheets[0]!.id : doc.activeSheetId;
  return { ...doc, sheets, activeSheetId };
}

/* ── merge helpers ── */

function rowIndex(tab: SheetTab, rowId: string): number {
  return tab.rows.findIndex((r) => r.id === rowId);
}

function colIndex(tab: SheetTab, colId: string): number {
  return tab.columns.findIndex((c) => c.id === colId);
}

function normalizeMergeRange(
  tab: SheetTab,
  range: SheetMerge,
): SheetMerge | null {
  const r0 = rowIndex(tab, range.startRowId);
  const r1 = rowIndex(tab, range.endRowId);
  const c0 = colIndex(tab, range.startColId);
  const c1 = colIndex(tab, range.endColId);
  if (r0 < 0 || r1 < 0 || c0 < 0 || c1 < 0) return null;
  const rs = Math.min(r0, r1);
  const re = Math.max(r0, r1);
  const cs = Math.min(c0, c1);
  const ce = Math.max(c0, c1);
  if (rs === re && cs === ce) return null; // 单格不算合并
  return {
    startRowId: tab.rows[rs]!.id,
    startColId: tab.columns[cs]!.id,
    endRowId: tab.rows[re]!.id,
    endColId: tab.columns[ce]!.id,
  };
}

function mergeOverlaps(tab: SheetTab, a: SheetMerge, b: SheetMerge): boolean {
  const ar0 = rowIndex(tab, a.startRowId);
  const ar1 = rowIndex(tab, a.endRowId);
  const ac0 = colIndex(tab, a.startColId);
  const ac1 = colIndex(tab, a.endColId);
  const br0 = rowIndex(tab, b.startRowId);
  const br1 = rowIndex(tab, b.endRowId);
  const bc0 = colIndex(tab, b.startColId);
  const bc1 = colIndex(tab, b.endColId);
  if (ar0 < 0 || ar1 < 0 || br0 < 0 || br1 < 0) return false;
  if (ac0 < 0 || ac1 < 0 || bc0 < 0 || bc1 < 0) return false;
  const aR0 = Math.min(ar0, ar1);
  const aR1 = Math.max(ar0, ar1);
  const aC0 = Math.min(ac0, ac1);
  const aC1 = Math.max(ac0, ac1);
  const bR0 = Math.min(br0, br1);
  const bR1 = Math.max(br0, br1);
  const bC0 = Math.min(bc0, bc1);
  const bC1 = Math.max(bc0, bc1);
  return !(aR1 < bR0 || bR1 < aR0 || aC1 < bC0 || bC1 < aC0);
}

export function findMergeAt(
  tab: SheetTab,
  rowId: string,
  columnId: string,
): SheetMerge | null {
  const ri = rowIndex(tab, rowId);
  const ci = colIndex(tab, columnId);
  if (ri < 0 || ci < 0) return null;
  for (const m of tab.merges ?? []) {
    const r0 = rowIndex(tab, m.startRowId);
    const r1 = rowIndex(tab, m.endRowId);
    const c0 = colIndex(tab, m.startColId);
    const c1 = colIndex(tab, m.endColId);
    if (r0 < 0 || r1 < 0 || c0 < 0 || c1 < 0) continue;
    const rs = Math.min(r0, r1);
    const re = Math.max(r0, r1);
    const cs = Math.min(c0, c1);
    const ce = Math.max(c0, c1);
    if (ri >= rs && ri <= re && ci >= cs && ci <= ce) return m;
  }
  return null;
}

export function isMergeMaster(
  tab: SheetTab,
  rowId: string,
  columnId: string,
): boolean {
  const m = findMergeAt(tab, rowId, columnId);
  if (!m) return true;
  return m.startRowId === rowId && m.startColId === columnId;
}

export function isCoveredCell(
  tab: SheetTab,
  rowId: string,
  columnId: string,
): boolean {
  const m = findMergeAt(tab, rowId, columnId);
  if (!m) return false;
  return !(m.startRowId === rowId && m.startColId === columnId);
}

export function mergeSpan(
  tab: SheetTab,
  merge: SheetMerge,
): { rowSpan: number; colSpan: number } {
  const r0 = rowIndex(tab, merge.startRowId);
  const r1 = rowIndex(tab, merge.endRowId);
  const c0 = colIndex(tab, merge.startColId);
  const c1 = colIndex(tab, merge.endColId);
  return {
    rowSpan: Math.abs(r1 - r0) + 1,
    colSpan: Math.abs(c1 - c0) + 1,
  };
}

function scrubMerges(tab: SheetTab): SheetTab {
  const rowIds = new Set(tab.rows.map((r) => r.id));
  const colIds = new Set(tab.columns.map((c) => c.id));
  const merges = (tab.merges ?? []).filter(
    (m) =>
      rowIds.has(m.startRowId) &&
      rowIds.has(m.endRowId) &&
      colIds.has(m.startColId) &&
      colIds.has(m.endColId) &&
      normalizeMergeRange(tab, m) != null,
  );
  return { ...tab, merges };
}

export function mergeSheetCells(
  tab: SheetTab,
  range: SheetMerge,
): SheetTab {
  const normalized = normalizeMergeRange(tab, range);
  if (!normalized) {
    throw new Error("invalid merge range (need at least 2 cells)");
  }
  for (const existing of tab.merges ?? []) {
    if (mergeOverlaps(tab, existing, normalized)) {
      throw new Error("merge overlaps existing merge");
    }
  }
  return {
    ...tab,
    merges: [...(tab.merges ?? []), normalized],
  };
}

export function unmergeSheetCells(
  tab: SheetTab,
  rowId: string,
  columnId: string,
): { tab: SheetTab; removed: SheetMerge | null } {
  const hit = findMergeAt(tab, rowId, columnId);
  if (!hit) return { tab, removed: null };
  return {
    tab: {
      ...tab,
      merges: (tab.merges ?? []).filter((m) => m !== hit),
    },
    removed: hit,
  };
}

/** 写 covered 格时重定向到主格 */
export function resolveWriteTarget(
  tab: SheetTab,
  rowId: string,
  columnId: string,
): { rowId: string; columnId: string; redirected: boolean } {
  const m = findMergeAt(tab, rowId, columnId);
  if (!m || (m.startRowId === rowId && m.startColId === columnId)) {
    return { rowId, columnId, redirected: false };
  }
  return {
    rowId: m.startRowId,
    columnId: m.startColId,
    redirected: true,
  };
}

/* ── 单表（tab）级操作 ── */

export function addSheetColumn(tab: SheetTab, name?: string): SheetTab {
  const col: SheetColumn = {
    id: newId("c"),
    name: name?.trim() || `列${tab.columns.length + 1}`,
  };
  return {
    ...tab,
    columns: [...tab.columns, col],
    rows: tab.rows.map((r) => ({
      ...r,
      cells: { ...r.cells, [col.id]: emptySheetCell() },
    })),
  };
}

export function addSheetRow(tab: SheetTab): SheetTab {
  const cells: Record<string, SheetCell> = {};
  for (const col of tab.columns) cells[col.id] = emptySheetCell();
  return {
    ...tab,
    rows: [...tab.rows, { id: newId("r"), cells }],
  };
}

export function setSheetCell(
  tab: SheetTab,
  rowId: string,
  columnId: string,
  value: string,
): SheetTab {
  const target = resolveWriteTarget(tab, rowId, columnId);
  return {
    ...tab,
    rows: tab.rows.map((r) => {
      if (r.id !== target.rowId) return r;
      const prev = r.cells[target.columnId] ?? emptySheetCell();
      return {
        ...r,
        cells: {
          ...r.cells,
          [target.columnId]: { v: value, ...(prev.style ? { style: prev.style } : {}) },
        },
      };
    }),
  };
}

export function setSheetCellStyle(
  tab: SheetTab,
  rowId: string,
  columnId: string,
  patch: SheetCellStyle | null,
): SheetTab {
  const target = resolveWriteTarget(tab, rowId, columnId);
  return {
    ...tab,
    rows: tab.rows.map((r) => {
      if (r.id !== target.rowId) return r;
      const prev = r.cells[target.columnId] ?? emptySheetCell();
      const style = mergeCellStyle(prev.style, patch);
      const next: SheetCell = style ? { v: prev.v, style } : { v: prev.v };
      return { ...r, cells: { ...r.cells, [target.columnId]: next } };
    }),
  };
}

export function setSheetCellStyles(
  tab: SheetTab,
  updates: Array<{
    rowId: string;
    column: string;
    style: SheetCellStyle | null;
  }>,
): { tab: SheetTab; applied: number; errors: string[]; warnings: string[] } {
  let next = tab;
  let applied = 0;
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const u of updates) {
    const rowId = u.rowId.trim();
    const col = resolveSheetColumn(next, u.column);
    if (!rowId) {
      errors.push("empty rowId");
      continue;
    }
    if (!col) {
      errors.push(`unknown column: ${u.column}`);
      continue;
    }
    if (!next.rows.some((r) => r.id === rowId)) {
      errors.push(`unknown rowId: ${rowId}`);
      continue;
    }
    const target = resolveWriteTarget(next, rowId, col.id);
    if (target.redirected) {
      warnings.push(`redirected ${rowId}/${col.id} → merge master`);
    }
    next = setSheetCellStyle(next, target.rowId, target.columnId, u.style);
    applied += 1;
  }
  return { tab: next, applied, errors, warnings };
}

export function setSheetColumnName(
  tab: SheetTab,
  columnId: string,
  name: string,
): SheetTab {
  return {
    ...tab,
    columns: tab.columns.map((c) => (c.id === columnId ? { ...c, name } : c)),
  };
}

export function removeSheetRow(tab: SheetTab, rowId: string): SheetTab {
  return scrubMerges({ ...tab, rows: tab.rows.filter((r) => r.id !== rowId) });
}

export function removeSheetRows(
  tab: SheetTab,
  rowIds: string[],
): { tab: SheetTab; removed: string[]; missing: string[] } {
  const want = new Set(rowIds.map((id) => id.trim()).filter(Boolean));
  const missing: string[] = [];
  for (const id of want) {
    if (!tab.rows.some((r) => r.id === id)) missing.push(id);
  }
  const removed = [...want].filter((id) => !missing.includes(id));
  return {
    tab: scrubMerges({ ...tab, rows: tab.rows.filter((r) => !want.has(r.id)) }),
    removed,
    missing,
  };
}

export function removeSheetColumns(
  tab: SheetTab,
  columns: string[],
): {
  tab: SheetTab;
  removed: Array<{ id: string; name: string }>;
  errors: string[];
} {
  const errors: string[] = [];
  const toRemove = new Set<string>();
  const removed: Array<{ id: string; name: string }> = [];
  for (const raw of columns) {
    const col = resolveSheetColumn(tab, raw);
    if (!col) {
      errors.push(`unknown column: ${raw}`);
      continue;
    }
    if (toRemove.has(col.id)) continue;
    toRemove.add(col.id);
    removed.push({ id: col.id, name: col.name });
  }
  if (toRemove.size === 0) {
    return { tab, removed: [], errors };
  }
  if (tab.columns.length - toRemove.size < 1) {
    throw new Error("cannot delete all columns; at least one column required");
  }
  const nextColumns = tab.columns.filter((c) => !toRemove.has(c.id));
  const nextRows = tab.rows.map((r) => {
    const cells = { ...r.cells };
    for (const id of toRemove) delete cells[id];
    return { ...r, cells };
  });
  return {
    tab: scrubMerges({ ...tab, columns: nextColumns, rows: nextRows }),
    removed,
    errors,
  };
}

export function resolveSheetColumn(
  tab: SheetTab,
  column: string,
): SheetColumn | null {
  const key = column.trim();
  if (!key) return null;
  const byId = tab.columns.find((c) => c.id === key);
  if (byId) return byId;
  const byName = tab.columns.find((c) => c.name === key);
  if (byName) return byName;
  const lower = key.toLowerCase();
  return tab.columns.find((c) => c.name.toLowerCase() === lower) ?? null;
}

export function sheetRowAsNamedCells(
  tab: SheetTab,
  row: SheetRow,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of tab.columns) {
    out[col.name] = getCellValue(row.cells[col.id]);
  }
  return out;
}

export type SheetStyleScope = "cell" | "row" | "column" | "sheet";

export interface SheetStyleCellEntry {
  rowId: string;
  column: string;
  columnId: string;
  style: SheetCellStyle | null;
}

export interface CollectSheetCellStylesOpts {
  scope: SheetStyleScope;
  rowId?: string;
  column?: string;
  /** 默认 false：只返回有 style 的格；true 时补 null（单格始终返回） */
  includeEmpty?: boolean;
}

/** includeEmpty 时单元格总数上限，防爆 token */
export const SHEET_STYLE_INCLUDE_EMPTY_MAX = 5000;

/**
 * 只读收集单元格样式（不含 v）。
 * scope=cell 始终一条；其余默认稀疏。
 */
export function collectSheetCellStyles(
  tab: SheetTab,
  opts: CollectSheetCellStylesOpts,
): { cells: SheetStyleCellEntry[]; styledCount: number } {
  const includeEmpty = opts.includeEmpty === true;
  const scope = opts.scope;

  const pushEntry = (
    out: SheetStyleCellEntry[],
    rowId: string,
    col: SheetColumn,
    cell: SheetCell | undefined,
  ) => {
    const style = getCellStyle(cell) ?? null;
    if (!includeEmpty && style == null && scope !== "cell") return;
    out.push({
      rowId,
      column: col.name,
      columnId: col.id,
      style,
    });
  };

  if (scope === "cell") {
    const rowId = String(opts.rowId ?? "").trim();
    if (!rowId) throw new Error("rowId is required for scope=cell");
    const colKey = String(opts.column ?? "").trim();
    if (!colKey) throw new Error("column is required for scope=cell");
    const row = tab.rows.find((r) => r.id === rowId);
    if (!row) throw new Error(`row not found: ${rowId}`);
    const col = resolveSheetColumn(tab, colKey);
    if (!col) throw new Error(`unknown column: ${colKey}`);
    const style = getCellStyle(row.cells[col.id]) ?? null;
    return {
      cells: [
        {
          rowId,
          column: col.name,
          columnId: col.id,
          style,
        },
      ],
      styledCount: style ? 1 : 0,
    };
  }

  if (scope === "row") {
    const rowId = String(opts.rowId ?? "").trim();
    if (!rowId) throw new Error("rowId is required for scope=row");
    const row = tab.rows.find((r) => r.id === rowId);
    if (!row) throw new Error(`row not found: ${rowId}`);
    if (includeEmpty && tab.columns.length > SHEET_STYLE_INCLUDE_EMPTY_MAX) {
      throw new Error(
        `includeEmpty exceeds max ${SHEET_STYLE_INCLUDE_EMPTY_MAX} cells`,
      );
    }
    const cells: SheetStyleCellEntry[] = [];
    let styledCount = 0;
    for (const col of tab.columns) {
      const style = getCellStyle(row.cells[col.id]);
      if (style) styledCount += 1;
      pushEntry(cells, row.id, col, row.cells[col.id]);
    }
    return { cells, styledCount };
  }

  if (scope === "column") {
    const colKey = String(opts.column ?? "").trim();
    if (!colKey) throw new Error("column is required for scope=column");
    const col = resolveSheetColumn(tab, colKey);
    if (!col) throw new Error(`unknown column: ${colKey}`);
    if (includeEmpty && tab.rows.length > SHEET_STYLE_INCLUDE_EMPTY_MAX) {
      throw new Error(
        `includeEmpty exceeds max ${SHEET_STYLE_INCLUDE_EMPTY_MAX} cells`,
      );
    }
    const cells: SheetStyleCellEntry[] = [];
    let styledCount = 0;
    for (const row of tab.rows) {
      const style = getCellStyle(row.cells[col.id]);
      if (style) styledCount += 1;
      pushEntry(cells, row.id, col, row.cells[col.id]);
    }
    return { cells, styledCount };
  }

  // sheet
  const total = tab.rows.length * tab.columns.length;
  if (includeEmpty && total > SHEET_STYLE_INCLUDE_EMPTY_MAX) {
    throw new Error(
      `includeEmpty exceeds max ${SHEET_STYLE_INCLUDE_EMPTY_MAX} cells`,
    );
  }
  const cells: SheetStyleCellEntry[] = [];
  let styledCount = 0;
  for (const row of tab.rows) {
    for (const col of tab.columns) {
      const style = getCellStyle(row.cells[col.id]);
      if (style) styledCount += 1;
      pushEntry(cells, row.id, col, row.cells[col.id]);
    }
  }
  return { cells, styledCount };
}

export function setSheetCells(
  tab: SheetTab,
  updates: Array<{ rowId: string; column: string; value: string }>,
): { tab: SheetTab; applied: number; errors: string[]; warnings: string[] } {
  let next = tab;
  let applied = 0;
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const u of updates) {
    const rowId = u.rowId.trim();
    const col = resolveSheetColumn(next, u.column);
    if (!rowId) {
      errors.push("empty rowId");
      continue;
    }
    if (!col) {
      errors.push(`unknown column: ${u.column}`);
      continue;
    }
    if (!next.rows.some((r) => r.id === rowId)) {
      errors.push(`unknown rowId: ${rowId}`);
      continue;
    }
    const target = resolveWriteTarget(next, rowId, col.id);
    if (target.redirected) {
      warnings.push(`redirected ${rowId}/${col.id} → merge master`);
    }
    next = setSheetCell(next, target.rowId, target.columnId, u.value);
    applied += 1;
  }
  return { tab: next, applied, errors, warnings };
}

export function upsertSheetRow(
  tab: SheetTab,
  cells: Record<string, string>,
  rowId?: string,
): { tab: SheetTab; row: SheetRow; created: boolean } {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(cells)) {
    const col = resolveSheetColumn(tab, key);
    if (!col) {
      throw new Error(`unknown column: ${key}`);
    }
    resolved[col.id] = value;
  }

  const id = rowId?.trim() || newId("r");
  const existing = tab.rows.find((r) => r.id === id);
  if (existing) {
    const mergedCells: Record<string, SheetCell> = { ...existing.cells };
    for (const [cid, v] of Object.entries(resolved)) {
      const prev = mergedCells[cid] ?? emptySheetCell();
      mergedCells[cid] = {
        v,
        ...(prev.style ? { style: prev.style } : {}),
      };
    }
    const row: SheetRow = { id, cells: mergedCells };
    return {
      tab: {
        ...tab,
        rows: tab.rows.map((r) => (r.id === id ? row : r)),
      },
      row,
      created: false,
    };
  }

  const cellsFull: Record<string, SheetCell> = {};
  for (const col of tab.columns) {
    cellsFull[col.id] = emptySheetCell(resolved[col.id] ?? "");
  }
  const row: SheetRow = { id, cells: cellsFull };
  return {
    tab: { ...tab, rows: [...tab.rows, row] },
    row,
    created: true,
  };
}

/** 只更新已有行；rowId 必填且必须存在。新建请用 insertSheetRows（append / after）。 */
export function updateSheetRow(
  tab: SheetTab,
  rowId: string,
  cells: Record<string, string>,
): { tab: SheetTab; row: SheetRow } {
  const id = rowId.trim();
  if (!id) throw new Error("rowId is required");
  if (!tab.rows.some((r) => r.id === id)) {
    throw new Error(`row not found: ${id}`);
  }
  const { tab: next, row } = upsertSheetRow(tab, cells, id);
  return { tab: next, row };
}

export type InsertSheetRowsOptions = {
  /** 0-based：在此下标处插入（原该行及之后下移）。缺省 = 表末追加 */
  atIndex?: number;
  /** 插在此 rowId 之前（优先于 afterRowId / atIndex） */
  beforeRowId?: string;
  /** 插在此 rowId 之后 */
  afterRowId?: string;
};

function resolveInsertAtIndex(
  tab: SheetTab,
  opts?: InsertSheetRowsOptions,
): number {
  if (!opts) return tab.rows.length;
  const before = opts.beforeRowId?.trim();
  if (before) {
    const i = tab.rows.findIndex((r) => r.id === before);
    if (i < 0) throw new Error(`row not found: ${before}`);
    return i;
  }
  const after = opts.afterRowId?.trim();
  if (after) {
    const i = tab.rows.findIndex((r) => r.id === after);
    if (i < 0) throw new Error(`row not found: ${after}`);
    return i + 1;
  }
  if (opts.atIndex != null) {
    const n = Math.floor(Number(opts.atIndex));
    if (!Number.isFinite(n) || n < 0 || n > tab.rows.length) {
      throw new Error(
        `atIndex out of range: ${opts.atIndex} (allowed 0..${tab.rows.length})`,
      );
    }
    return n;
  }
  return tab.rows.length;
}

/**
 * 批量插入行；默认表末追加。
 * 可用 atIndex / beforeRowId / afterRowId 插到中间。未知列名在写任何行之前失败。
 * merges 按 rowId 引用，插行不改合并区。
 */
export function insertSheetRows(
  tab: SheetTab,
  rows: Array<Record<string, string>>,
  opts?: InsertSheetRowsOptions,
): { tab: SheetTab; rowIds: string[]; inserted: number; atIndex: number } {
  for (const cells of rows) {
    for (const key of Object.keys(cells)) {
      if (!resolveSheetColumn(tab, key)) {
        throw new Error(`unknown column: ${key}`);
      }
    }
  }
  const atIndex = resolveInsertAtIndex(tab, opts);
  const newRows: SheetRow[] = [];
  const rowIds: string[] = [];
  for (const cells of rows) {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(cells)) {
      const col = resolveSheetColumn(tab, key)!;
      resolved[col.id] = value;
    }
    const cellsFull: Record<string, SheetCell> = {};
    for (const col of tab.columns) {
      cellsFull[col.id] = emptySheetCell(resolved[col.id] ?? "");
    }
    const row: SheetRow = { id: newId("r"), cells: cellsFull };
    newRows.push(row);
    rowIds.push(row.id);
  }
  return {
    tab: {
      ...tab,
      rows: [
        ...tab.rows.slice(0, atIndex),
        ...newRows,
        ...tab.rows.slice(atIndex),
      ],
    },
    rowIds,
    inserted: rowIds.length,
    atIndex,
  };
}

const OVERWRITE_MAX_COLUMNS = 50;
const OVERWRITE_MAX_ROWS = 500;

/** 整表替换列与行；保留 tab.id，可选改 name。旧 column/row id 全部重建。 */
export function overwriteSheetTab(
  tab: SheetTab,
  input: { name?: string; columns: string[]; rows: string[][] },
): SheetTab {
  const colNames = input.columns.map((c) => String(c ?? "").trim());
  if (colNames.length === 0) {
    throw new Error("columns is required");
  }
  if (colNames.length > OVERWRITE_MAX_COLUMNS) {
    throw new Error(`columns exceeds max ${OVERWRITE_MAX_COLUMNS}`);
  }
  if (colNames.some((c) => !c)) {
    throw new Error("empty column name");
  }
  const seen = new Set<string>();
  for (const name of colNames) {
    if (seen.has(name)) {
      throw new Error(`duplicate column: ${name}`);
    }
    seen.add(name);
  }
  if (input.rows.length > OVERWRITE_MAX_ROWS) {
    throw new Error(`rows exceeds max ${OVERWRITE_MAX_ROWS}`);
  }

  const columns: SheetColumn[] = colNames.map((name) => ({
    id: newId("c"),
    name,
  }));
  const rows: SheetRow[] = [];
  for (let i = 0; i < input.rows.length; i += 1) {
    const raw = input.rows[i] ?? [];
    if (raw.length > columns.length) {
      throw new Error(`row ${i} has too many cells`);
    }
    const cells: Record<string, SheetCell> = {};
    for (let j = 0; j < columns.length; j += 1) {
      const v = raw[j];
      cells[columns[j]!.id] = emptySheetCell(v == null ? "" : String(v));
    }
    rows.push({ id: newId("r"), cells });
  }

  const name = input.name?.trim() || tab.name;
  return { id: tab.id, name, columns, rows, merges: [] };
}
