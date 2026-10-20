/**
 * `.sheet` 工作簿 Agent tools（多工作表）。
 * 写操作可选 sheet（表名或 id），默认当前 active 表。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { assertDocumentAccess, DocumentError } from "../../access/access-control.js";
import { getDocument, updateDocument } from "../../documents/document.service.js";
import { FILE_TYPE } from "../../../shared/file-types.js";
import {
  addWorkbookSheet,
  collectSheetCellStyles,
  insertSheetRows,
  mergeSheetCells,
  normalizeStyle,
  overwriteSheetTab,
  parseSheetDocument,
  removeSheetColumns,
  removeSheetRows,
  removeWorkbookSheet,
  renameWorkbookSheet,
  replaceSheetTab,
  resolveSheetColumn,
  resolveSheetTab,
  serializeSheetDocument,
  setSheetCellStyles,
  setSheetCells,
  setSheetColumnName,
  sheetRowAsNamedCells,
  unmergeSheetCells,
  updateSheetRow,
  type SheetCellStyle,
  type SheetDocument,
  type SheetStyleScope,
  type SheetTab,
} from "../../../shared/sheetDocument.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

const LIST_DEFAULT_LIMIT = 50;
const LIST_MAX_LIMIT = 100;
const SET_CELLS_MAX = 200;
const INSERT_ROWS_MAX = 100;

type RowCellsParam = { cells?: Array<{ column?: string; value?: unknown }> };

function parseNamedCells(
  cells: Array<{ column?: string; value?: unknown }> | undefined,
  label = "cells",
): Record<string, string> {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new Error(`${label} is required`);
  }
  const out: Record<string, string> = {};
  for (const item of cells) {
    const column = String(item.column ?? "").trim();
    if (!column) throw new Error(`${label}[].column is required`);
    out[column] = item.value == null ? "" : String(item.value);
  }
  return out;
}

function parseRowsParam(
  raw: RowCellsParam[] | undefined,
): Array<Record<string, string>> {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("rows is required");
  }
  if (raw.length > INSERT_ROWS_MAX) {
    throw new Error(`rows exceeds max ${INSERT_ROWS_MAX}`);
  }
  return raw.map((row, i) => parseNamedCells(row.cells, `rows[${i}].cells`));
}

const sheetParam = Type.Optional(
  Type.String({
    description: "工作表名称或 id；省略则用当前 active 表",
  }),
);

function asAgentError(err: unknown): never {
  if (err instanceof DocumentError) {
    throw new Error(`${err.code}: ${err.message}`);
  }
  throw err;
}

function loadWorkbookForRead(documentId: string, visitorId: string) {
  assertDocumentAccess(documentId, visitorId, "read");
  const doc = getDocument(documentId, visitorId, "json");
  if (doc.fileType !== FILE_TYPE.SHEET) {
    throw new Error(`NOT_A_SHEET: document fileType is '${doc.fileType}', expected sheet`);
  }
  const workbook = parseSheetDocument(doc.content ?? "");
  return { doc, workbook };
}

function loadWorkbookForEdit(documentId: string, visitorId: string) {
  assertDocumentAccess(documentId, visitorId, "edit");
  const doc = getDocument(documentId, visitorId, "json");
  if (doc.fileType !== FILE_TYPE.SHEET) {
    throw new Error(`NOT_A_SHEET: document fileType is '${doc.fileType}', expected sheet`);
  }
  const headCommitId = doc.headCommitId;
  if (!headCommitId) {
    throw new Error("DOCUMENT_HAS_NO_HEAD: 文档缺少 headCommitId，无法安全写入");
  }
  const workbook = parseSheetDocument(doc.content ?? "");
  return { doc, workbook, headCommitId };
}

function requireTab(workbook: SheetDocument, sheet?: string): SheetTab {
  const tab = resolveSheetTab(workbook, sheet);
  if (!tab) {
    throw new Error(
      sheet?.trim()
        ? `unknown sheet: ${sheet}`
        : "workbook has no sheets",
    );
  }
  return tab;
}

function saveWorkbook(params: {
  visitorId: string;
  documentId: string;
  workbook: SheetDocument;
  headCommitId: string;
}) {
  return updateDocument({
    actorVisitorId: params.visitorId,
    documentId: params.documentId,
    content: serializeSheetDocument(params.workbook),
    version: { localBaseCommitId: params.headCommitId },
  });
}

function sheetsSummary(workbook: SheetDocument) {
  return workbook.sheets.map((s) => ({
    id: s.id,
    name: s.name,
    rowCount: s.rows.length,
    columnCount: s.columns.length,
    active: s.id === workbook.activeSheetId,
  }));
}

export function sheetGetSchemaTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_get_schema",
    label: "读取表格结构",
    description:
      "读取 .sheet 工作簿：全部工作表列表，以及指定表（默认 active）的列定义。改表前先调用。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; sheet?: string };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      try {
        const { doc, workbook } = loadWorkbookForRead(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        return asToolResult({
          documentId: doc.documentId,
          displayName: doc.displayName,
          fileType: doc.fileType,
          headCommitId: doc.headCommitId ?? null,
          sheets: sheetsSummary(workbook),
          sheet: { id: tab.id, name: tab.name },
          rowCount: tab.rows.length,
          columns: tab.columns.map((c) => ({ id: c.id, name: c.name })),
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetListRowsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_list_rows",
    label: "列出表格行",
    description:
      "分页列出指定工作表的行。每行含 rowId 与按列名展开的 cells（仅文本值，不含样式）。默认 limit=50，最大 100。查样式用 sheet_get_styles。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      offset: Type.Optional(Type.Number({ description: "起始偏移，默认 0" })),
      limit: Type.Optional(Type.Number({ description: "条数，默认 50，最大 100" })),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        offset?: number;
        limit?: number;
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      const offset = Math.max(0, Math.floor(Number(p.offset) || 0));
      let limit = Math.floor(Number(p.limit) || LIST_DEFAULT_LIMIT);
      if (!Number.isFinite(limit) || limit < 1) limit = LIST_DEFAULT_LIMIT;
      limit = Math.min(limit, LIST_MAX_LIMIT);
      try {
        const { doc, workbook } = loadWorkbookForRead(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const slice = tab.rows.slice(offset, offset + limit);
        return asToolResult({
          documentId: doc.documentId,
          displayName: doc.displayName,
          sheet: { id: tab.id, name: tab.name },
          total: tab.rows.length,
          offset,
          limit,
          hasMore: offset + slice.length < tab.rows.length,
          columns: tab.columns.map((c) => ({ id: c.id, name: c.name })),
          rows: slice.map((r) => ({
            rowId: r.id,
            cells: sheetRowAsNamedCells(tab, r),
          })),
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

const STYLE_SCOPES = new Set<SheetStyleScope>(["cell", "row", "column", "sheet"]);

export function sheetGetStylesTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_get_styles",
    label: "读取表格样式",
    description:
      "读取 .sheet 单元格样式（bg / color / bold / italic / fontSize）。" +
      "scope=cell|row|column|sheet。默认只返回已设置样式的格；单格无样式返回 style:null。" +
      "要单元格文本请用 sheet_list_rows；写样式用 sheet_set_cell_style。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      scope: Type.String({
        description: "cell | row | column | sheet",
      }),
      rowId: Type.Optional(
        Type.String({ description: "scope=cell / row 时必填" }),
      ),
      column: Type.Optional(
        Type.String({ description: "scope=cell / column 时必填；列名或 columnId" }),
      ),
      includeEmpty: Type.Optional(
        Type.Boolean({
          description:
            "默认 false。true 时补无样式格（style:null）；单元格过多会失败",
        }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        scope?: string;
        rowId?: string;
        column?: string;
        includeEmpty?: boolean;
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      const scopeRaw = String(p.scope ?? "").trim() as SheetStyleScope;
      if (!STYLE_SCOPES.has(scopeRaw)) {
        throw new Error("scope must be cell | row | column | sheet");
      }
      const includeEmpty = p.includeEmpty === true;
      try {
        const { doc, workbook } = loadWorkbookForRead(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const { cells, styledCount } = collectSheetCellStyles(tab, {
          scope: scopeRaw,
          rowId: p.rowId,
          column: p.column,
          includeEmpty,
        });
        return asToolResult({
          documentId: doc.documentId,
          displayName: doc.displayName,
          sheet: { id: tab.id, name: tab.name },
          scope: scopeRaw,
          includeEmpty,
          styledCount,
          cells,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetSetCellsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_set_cells",
    label: "修改表格单元格",
    description:
      "批量修改指定工作表若干单元格。column 可为列名或 columnId。单次最多 200 条。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      updates: Type.Array(
        Type.Object({
          rowId: Type.String({ description: "行 id" }),
          column: Type.String({ description: "列名或 columnId" }),
          value: Type.String({ description: "单元格文本" }),
        }),
        { description: "要写入的格子列表" },
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        updates?: Array<{ rowId?: string; column?: string; value?: unknown }>;
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      if (!Array.isArray(p.updates) || p.updates.length === 0) {
        throw new Error("updates is required");
      }
      if (p.updates.length > SET_CELLS_MAX) {
        throw new Error(`updates exceeds max ${SET_CELLS_MAX}`);
      }
      const updates = p.updates.map((u) => ({
        rowId: String(u.rowId ?? ""),
        column: String(u.column ?? ""),
        value: u.value == null ? "" : String(u.value),
      }));
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const { tab: nextTab, applied, errors } = setSheetCells(tab, updates);
        if (applied === 0) {
          return asToolResult({
            status: "noop",
            documentId,
            sheet: { id: tab.id, name: tab.name },
            applied: 0,
            errors,
            message: "没有成功写入任何单元格",
          });
        }
        const nextWb = replaceSheetTab(workbook, nextTab);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          applied,
          errors,
          rowCount: nextTab.rows.length,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

const rowCellsSchema = Type.Array(
  Type.Object({
    column: Type.String({ description: "列名或 columnId" }),
    value: Type.String({ description: "单元格文本" }),
  }),
  { description: "本行要写入的字段" },
);

const rowsSchema = Type.Array(
  Type.Object({ cells: rowCellsSchema }),
  { description: "行列表（顺序保留）；单次最多 100 行" },
);

/** 更新已有行（rowId 必填）；新建用 append / insert_at */
export function sheetUpdateRowTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_update_row",
    label: "更新表格行",
    description:
      "按 rowId 更新已有行的若干列（patch）。rowId 必填且必须已存在；表末追加用 sheet_append_rows，插在某行后面用 sheet_insert_rows_at。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      rowId: Type.String({ description: "已有行 id" }),
      cells: rowCellsSchema,
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        rowId?: string;
        cells?: Array<{ column?: string; value?: unknown }>;
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      const rowId = String(p.rowId ?? "").trim();
      if (!rowId) throw new Error("rowId is required");
      const cells = parseNamedCells(p.cells);
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const { tab: nextTab, row } = updateSheetRow(tab, rowId, cells);
        const nextWb = replaceSheetTab(workbook, nextTab);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          rowId: row.id,
          cells: sheetRowAsNamedCells(nextTab, row),
          rowCount: nextTab.rows.length,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

/** 表末批量追加 */
export function sheetAppendRowsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_append_rows",
    label: "追加表格行",
    description:
      "向指定工作表末尾一次追加多行。不改已有行；改已有行用 sheet_update_row / sheet_set_cells；插在某行后面用 sheet_insert_rows_at。单次最多 100 行。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      rows: rowsSchema,
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        rows?: RowCellsParam[];
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      const rows = parseRowsParam(p.rows);
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const { tab: nextTab, rowIds, inserted, atIndex } = insertSheetRows(
          tab,
          rows,
        );
        const nextWb = replaceSheetTab(workbook, nextTab);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          inserted,
          atIndex,
          rowIds,
          rowCount: nextTab.rows.length,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

/** 插在某行后面 */
export function sheetInsertRowsAtTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_insert_rows_at",
    label: "在指定行后插入",
    description:
      "在 afterRowId 这一行后面插入多行（原后续行下移）。afterRowId 必填。表末追加用 sheet_append_rows；改已有行用 sheet_update_row。单次最多 100 行。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      afterRowId: Type.String({ description: "插在此 rowId 之后" }),
      rows: rowsSchema,
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        afterRowId?: string;
        rows?: RowCellsParam[];
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      const afterRowId = String(p.afterRowId ?? "").trim();
      if (!afterRowId) throw new Error("afterRowId is required");
      const rows = parseRowsParam(p.rows);
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const { tab: nextTab, rowIds, inserted, atIndex } = insertSheetRows(
          tab,
          rows,
          { afterRowId },
        );
        const nextWb = replaceSheetTab(workbook, nextTab);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          afterRowId,
          inserted,
          atIndex,
          rowIds,
          rowCount: nextTab.rows.length,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetOverwriteTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_overwrite",
    label: "覆写表格",
    description:
      "用完整的列名列表 + 二维行数据，替换 .sheet 中某一个工作表的全部内容（旧行列作废）。不改其它工作表。局部改格/行请用 sheet_set_cells / sheet_update_row / sheet_append_rows / sheet_insert_rows_at。md/html 正文请用 overwrite_document。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      name: Type.Optional(Type.String({ description: "可选：同时改工作表名称" })),
      columns: Type.Array(Type.String({ description: "列名" }), {
        description: "新列名列表（顺序即列顺序），至少 1 个",
      }),
      rows: Type.Array(Type.Array(Type.String({ description: "单元格文本" })), {
        description: "二维行数据；每行 values[i] 对应 columns[i]；可为 []",
      }),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        name?: string;
        columns?: unknown[];
        rows?: unknown[];
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      if (!Array.isArray(p.columns) || p.columns.length === 0) {
        throw new Error("columns is required");
      }
      if (!Array.isArray(p.rows)) {
        throw new Error("rows is required");
      }
      const columns = p.columns.map((c) => String(c ?? ""));
      const rows = p.rows.map((row) => {
        if (!Array.isArray(row)) {
          throw new Error("rows[] must be an array of cell values");
        }
        return row.map((v) => (v == null ? "" : String(v)));
      });
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const nextTab = overwriteSheetTab(tab, {
          name: p.name,
          columns,
          rows,
        });
        const nextWb = replaceSheetTab(workbook, nextTab);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          columnCount: nextTab.columns.length,
          rowCount: nextTab.rows.length,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetRenameColumnTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_rename_column",
    label: "重命名表格列",
    description: "将指定工作表某一列改名。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      column: Type.String({ description: "当前列名或 columnId" }),
      name: Type.String({ description: "新列名" }),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        column?: string;
        name?: string;
      };
      const documentId = String(p.documentId ?? "").trim();
      const column = String(p.column ?? "").trim();
      const name = String(p.name ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      if (!column) throw new Error("column is required");
      if (!name) throw new Error("name is required");
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const col = resolveSheetColumn(tab, column);
        if (!col) throw new Error(`unknown column: ${column}`);
        const clash = tab.columns.find((c) => c.id !== col.id && c.name === name);
        if (clash) throw new Error(`column name already exists: ${name}`);
        if (col.name === name) {
          return asToolResult({
            status: "noop",
            documentId,
            sheet: { id: tab.id, name: tab.name },
            columnId: col.id,
            name,
            message: "列名未变化",
          });
        }
        const nextTab = setSheetColumnName(tab, col.id, name);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: replaceSheetTab(workbook, nextTab),
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          columnId: col.id,
          previousName: col.name,
          name,
          columns: nextTab.columns.map((c) => ({ id: c.id, name: c.name })),
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetDeleteRowsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_delete_rows",
    label: "删除表格行",
    description: "按 rowId 批量删除指定工作表的行。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      rowIds: Type.Array(Type.String(), { description: "要删除的行 id 列表" }),
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; sheet?: string; rowIds?: string[] };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      if (!Array.isArray(p.rowIds) || p.rowIds.length === 0) {
        throw new Error("rowIds is required");
      }
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const { tab: nextTab, removed, missing } = removeSheetRows(tab, p.rowIds);
        if (removed.length === 0) {
          return asToolResult({
            status: "noop",
            documentId,
            sheet: { id: tab.id, name: tab.name },
            removed: [],
            missing,
            message: "没有删除任何行",
          });
        }
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: replaceSheetTab(workbook, nextTab),
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          removed,
          missing,
          rowCount: nextTab.rows.length,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetDeleteColumnsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_delete_columns",
    label: "删除表格列",
    description: "按列名或 columnId 批量删除指定工作表的列（至少保留一列）。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      columns: Type.Array(Type.String(), {
        description: "列名或 columnId 列表",
      }),
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; sheet?: string; columns?: string[] };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      if (!Array.isArray(p.columns) || p.columns.length === 0) {
        throw new Error("columns is required");
      }
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const { tab: nextTab, removed, errors } = removeSheetColumns(tab, p.columns);
        if (removed.length === 0) {
          return asToolResult({
            status: "noop",
            documentId,
            sheet: { id: tab.id, name: tab.name },
            removed: [],
            errors,
            message: "没有删除任何列",
          });
        }
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: replaceSheetTab(workbook, nextTab),
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          removed,
          errors,
          columnCount: nextTab.columns.length,
          columns: nextTab.columns.map((c) => ({ id: c.id, name: c.name })),
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetAddSheetTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_add_sheet",
    label: "新建工作表",
    description: "在同一 .sheet 工作簿内新增一个工作表标签。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      name: Type.Optional(Type.String({ description: "工作表名称，可选" })),
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; name?: string };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const { doc: nextWb, tab } = addWorkbookSheet(workbook, p.name);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: tab.id, name: tab.name },
          sheets: sheetsSummary(nextWb),
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetRenameSheetTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_rename_sheet",
    label: "重命名工作表",
    description: "重命名工作簿内某个工作表标签（不是列名）。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: Type.String({ description: "当前工作表名称或 id" }),
      name: Type.String({ description: "新工作表名称" }),
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; sheet?: string; name?: string };
      const documentId = String(p.documentId ?? "").trim();
      const sheet = String(p.sheet ?? "").trim();
      const name = String(p.name ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      if (!sheet) throw new Error("sheet is required");
      if (!name) throw new Error("name is required");
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const before = requireTab(workbook, sheet);
        const nextWb = renameWorkbookSheet(workbook, sheet, name);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: before.id, name },
          previousName: before.name,
          sheets: sheetsSummary(nextWb),
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetDeleteSheetTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_delete_sheet",
    label: "删除工作表",
    description: "删除工作簿内某个工作表标签（至少保留一个）。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: Type.String({ description: "工作表名称或 id" }),
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; sheet?: string };
      const documentId = String(p.documentId ?? "").trim();
      const sheet = String(p.sheet ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      if (!sheet) throw new Error("sheet is required");
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, sheet);
        const nextWb = removeWorkbookSheet(workbook, sheet);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId: updated.documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          removed: { id: tab.id, name: tab.name },
          sheets: sheetsSummary(nextWb),
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetSetCellStyleTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_set_cell_style",
    label: "设置单元格样式",
    description:
      "批量设置 .sheet 单元格样式（底色 bg、字体色 color、粗体 bold、斜体 italic、字号 fontSize 12–24）。颜色须为 #RGB/#RRGGBB。style 传 null 清除样式。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      cells: Type.Array(
        Type.Object({
          rowId: Type.String(),
          column: Type.String({ description: "列名或 columnId" }),
          style: Type.Union([
            Type.Null(),
            Type.Object({
              bg: Type.Optional(Type.String()),
              color: Type.Optional(Type.String()),
              bold: Type.Optional(Type.Boolean()),
              italic: Type.Optional(Type.Boolean()),
              fontSize: Type.Optional(Type.Number()),
            }),
          ]),
        }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        cells?: Array<{ rowId?: string; column?: string; style?: unknown }>;
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      if (!Array.isArray(p.cells) || p.cells.length === 0) {
        throw new Error("cells is required");
      }
      if (p.cells.length > SET_CELLS_MAX) {
        throw new Error(`cells exceeds max ${SET_CELLS_MAX}`);
      }
      const updates = p.cells.map((c) => {
        const styleRaw = c.style;
        let style: SheetCellStyle | null;
        if (styleRaw === null) style = null;
        else style = normalizeStyle(styleRaw) ?? {};
        return {
          rowId: String(c.rowId ?? ""),
          column: String(c.column ?? ""),
          style,
        };
      });
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const { tab: nextTab, applied, errors, warnings } = setSheetCellStyles(
          tab,
          updates,
        );
        const nextWb = replaceSheetTab(workbook, nextTab);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          applied,
          errors,
          warnings,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetMergeCellsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_merge_cells",
    label: "合并单元格",
    description:
      "合并 .sheet 矩形区域为合并单元格（Excel 式 colspan/rowspan）。须至少 2 格：" +
      "传对角 startRowId+startColumn 与 endRowId+endColumn（列名或 columnId）。" +
      "先 sheet_list_rows 取 rowId。与已有合并重叠则失败。拆分用 sheet_unmerge_cells。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String({ description: "表格文档 documentId" }),
      sheet: sheetParam,
      startRowId: Type.String({ description: "合并区起始行 id" }),
      startColumn: Type.String({ description: "合并区起始列名或 columnId" }),
      endRowId: Type.String({ description: "合并区结束行 id" }),
      endColumn: Type.String({ description: "合并区结束列名或 columnId" }),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        startRowId?: string;
        startColumn?: string;
        endRowId?: string;
        endColumn?: string;
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const startCol = resolveSheetColumn(tab, String(p.startColumn ?? ""));
        const endCol = resolveSheetColumn(tab, String(p.endColumn ?? ""));
        if (!startCol || !endCol) throw new Error("unknown column");
        const nextTab = mergeSheetCells(tab, {
          startRowId: String(p.startRowId ?? ""),
          startColId: startCol.id,
          endRowId: String(p.endRowId ?? ""),
          endColId: endCol.id,
        });
        const nextWb = replaceSheetTab(workbook, nextTab);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          merge: nextTab.merges?.[nextTab.merges.length - 1] ?? null,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetUnmergeCellsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "sheet_unmerge_cells",
    label: "拆分合并单元格",
    description:
      "拆分 .sheet 中包含指定格子的合并区。列可用列名或 id。写后直接发布。",
    parameters: Type.Object({
      documentId: Type.String(),
      sheet: sheetParam,
      rowId: Type.String(),
      column: Type.String({ description: "列名或 columnId" }),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        sheet?: string;
        rowId?: string;
        column?: string;
      };
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      try {
        const { workbook, headCommitId } = loadWorkbookForEdit(documentId, visitorId);
        const tab = requireTab(workbook, p.sheet);
        const col = resolveSheetColumn(tab, String(p.column ?? ""));
        if (!col) throw new Error(`unknown column: ${p.column}`);
        const { tab: nextTab, removed } = unmergeSheetCells(
          tab,
          String(p.rowId ?? ""),
          col.id,
        );
        if (!removed) {
          return asToolResult({
            status: "noop",
            documentId,
            message: "cell is not in a merge",
          });
        }
        const nextWb = replaceSheetTab(workbook, nextTab);
        const updated = saveWorkbook({
          visitorId,
          documentId,
          workbook: nextWb,
          headCommitId,
        });
        return asToolResult({
          status: "updated",
          documentId,
          displayName: updated.displayName,
          headCommitId: updated.headCommitId ?? null,
          sheet: { id: nextTab.id, name: nextTab.name },
          removed,
        });
      } catch (err) {
        asAgentError(err);
      }
    },
  };
}

export function sheetTools(deps: ToolDeps): AgentTool[] {
  return [
    sheetGetSchemaTool(deps),
    sheetListRowsTool(deps),
    sheetGetStylesTool(deps),
    sheetSetCellsTool(deps),
    sheetUpdateRowTool(deps),
    sheetAppendRowsTool(deps),
    sheetInsertRowsAtTool(deps),
    sheetOverwriteTool(deps),
    sheetRenameColumnTool(deps),
    sheetDeleteRowsTool(deps),
    sheetDeleteColumnsTool(deps),
    sheetSetCellStyleTool(deps),
    sheetMergeCellsTool(deps),
    sheetUnmergeCellsTool(deps),
    sheetAddSheetTool(deps),
    sheetRenameSheetTool(deps),
    sheetDeleteSheetTool(deps),
  ];
}
