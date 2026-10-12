import { describe, expect, it } from "vitest";
import {
  addSheetColumn,
  addSheetRow,
  addWorkbookSheet,
  createEmptySheetDocument,
  getCellStyle,
  getCellValue,
  insertSheetRows,
  isCoveredCell,
  mergeSheetCells,
  overwriteSheetTab,
  parseSheetDocument,
  removeSheetColumns,
  removeSheetRows,
  removeWorkbookSheet,
  resolveSheetColumn,
  resolveSheetTab,
  serializeSheetDocument,
  setSheetCell,
  setSheetCellStyle,
  setSheetCells,
  unmergeSheetCells,
  upsertSheetRow,
} from "./sheetDocument.js";

describe("sheetDocument workbook", () => {
  it("round-trips empty workbook", () => {
    const doc = createEmptySheetDocument({ columnCount: 2, rowCount: 1 });
    expect(doc.sheets).toHaveLength(1);
    const again = parseSheetDocument(serializeSheetDocument(doc));
    expect(again.sheets).toHaveLength(1);
    expect(again.sheets[0]!.columns).toHaveLength(2);
    expect(again.sheets[0]!.rows).toHaveLength(1);
  });

  it("migrates v1 flat json", () => {
    const v1 = {
      version: 1,
      columns: [{ id: "c1", name: "A" }],
      rows: [{ id: "r1", cells: { c1: "x" } }],
    };
    const doc = parseSheetDocument(JSON.stringify(v1));
    expect(doc.version).toBe(2);
    expect(doc.sheets).toHaveLength(1);
    expect(getCellValue(doc.sheets[0]!.rows[0]!.cells.c1)).toBe("x");
  });

  it("adds and removes workbook sheets", () => {
    let doc = createEmptySheetDocument({ columnCount: 1, rowCount: 0 });
    const added = addWorkbookSheet(doc, "欲望");
    doc = added.doc;
    expect(doc.sheets).toHaveLength(2);
    expect(resolveSheetTab(doc, "欲望")?.id).toBe(added.tab.id);
    doc = removeWorkbookSheet(doc, added.tab.id);
    expect(doc.sheets).toHaveLength(1);
    expect(() => removeWorkbookSheet(doc, doc.sheets[0]!.id)).toThrow(/last sheet/);
  });

  it("patches cells and upserts rows on active tab", () => {
    let doc = createEmptySheetDocument({ columnCount: 2, rowCount: 1 });
    let tab = doc.sheets[0]!;
    const col = tab.columns[0]!;
    const rowId = tab.rows[0]!.id;
    expect(resolveSheetColumn(tab, col.name)?.id).toBe(col.id);
    const { tab: next, applied, errors } = setSheetCells(tab, [
      { rowId, column: col.name, value: "x" },
    ]);
    expect(applied).toBe(1);
    expect(errors).toEqual([]);
    tab = next;
    const up = upsertSheetRow(tab, { [col.name]: "y" });
    expect(up.created).toBe(true);
    const delRows = removeSheetRows(up.tab, [up.row.id]);
    expect(delRows.removed).toEqual([up.row.id]);
    const delCol = removeSheetColumns(delRows.tab, [delRows.tab.columns[1]!.name]);
    expect(delCol.tab.columns).toHaveLength(1);
  });

  it("grid helpers add row/column", () => {
    let tab = createEmptySheetDocument({ columnCount: 1, rowCount: 0 }).sheets[0]!;
    tab = addSheetRow(tab);
    tab = addSheetColumn(tab, "备注");
    expect(tab.columns).toHaveLength(2);
    tab = setSheetCell(tab, tab.rows[0]!.id, tab.columns[0]!.id, "hello");
    expect(getCellValue(tab.rows[0]!.cells[tab.columns[0]!.id])).toBe("hello");
  });

  it("falls back on invalid json", () => {
    const doc = parseSheetDocument("not-json");
    expect(doc.sheets[0]!.columns.length).toBeGreaterThan(0);
  });

  it("insertSheetRows appends and rejects unknown columns", () => {
    let tab = createEmptySheetDocument({ columnCount: 2, rowCount: 1 }).sheets[0]!;
    const col = tab.columns[0]!;
    const before = tab.rows.length;
    const inserted = insertSheetRows(tab, [
      { [col.name]: "a" },
      { [col.name]: "b" },
    ]);
    expect(inserted.inserted).toBe(2);
    expect(inserted.rowIds).toHaveLength(2);
    expect(inserted.tab.rows).toHaveLength(before + 2);
    expect(() => insertSheetRows(tab, [{ 不存在: "x" }])).toThrow(/unknown column/);
  });

  it("overwriteSheetTab replaces columns and rows, keeps sheet id", () => {
    const other = addWorkbookSheet(
      createEmptySheetDocument({ columnCount: 1, rowCount: 2 }),
      "第二页",
    );
    const tab = other.doc.sheets[0]!;
    const sheetId = tab.id;
    const next = overwriteSheetTab(tab, {
      columns: ["姓名", "金额"],
      rows: [
        ["张三", "10"],
        ["李四", "20"],
        ["王五"],
      ],
    });
    expect(next.id).toBe(sheetId);
    expect(next.columns.map((c) => c.name)).toEqual(["姓名", "金额"]);
    expect(next.rows).toHaveLength(3);
    expect(getCellValue(next.rows[2]!.cells[next.columns[1]!.id])).toBe("");
    expect(() =>
      overwriteSheetTab(tab, { columns: ["A", "A"], rows: [] }),
    ).toThrow(/duplicate column/);
    expect(() =>
      overwriteSheetTab(tab, { columns: ["A"], rows: [["1", "2"]] }),
    ).toThrow(/too many cells/);
  });

  it("parses styled cells and compact-serializes plain values", () => {
    const raw = {
      version: 2,
      activeSheetId: "s1",
      sheets: [
        {
          id: "s1",
          name: "Sheet1",
          columns: [
            { id: "c1", name: "A" },
            { id: "c2", name: "B" },
          ],
          rows: [
            {
              id: "r1",
              cells: {
                c1: { v: "标题", style: { bg: "#E8F5E9", bold: true } },
                c2: "x",
              },
            },
            { id: "r2", cells: { c1: "", c2: "" } },
          ],
          merges: [
            {
              startRowId: "r1",
              startColId: "c1",
              endRowId: "r1",
              endColId: "c2",
            },
          ],
        },
      ],
    };
    const doc = parseSheetDocument(JSON.stringify(raw));
    const tab = doc.sheets[0]!;
    expect(getCellValue(tab.rows[0]!.cells.c1)).toBe("标题");
    expect(getCellStyle(tab.rows[0]!.cells.c1)).toEqual({
      bg: "#E8F5E9",
      bold: true,
    });
    expect(tab.merges).toHaveLength(1);
    const again = JSON.parse(serializeSheetDocument(doc));
    expect(again.sheets[0].rows[0].cells.c1).toEqual({
      v: "标题",
      style: { bg: "#E8F5E9", bold: true },
    });
    expect(again.sheets[0].rows[0].cells.c2).toBe("x");
  });

  it("merge / style / scrub on delete", () => {
    let tab = createEmptySheetDocument({ columnCount: 2, rowCount: 2 }).sheets[0]!;
    const [c0, c1] = tab.columns;
    const [r0, r1] = tab.rows;
    tab = setSheetCell(tab, r0!.id, c0!.id, "m");
    tab = setSheetCellStyle(tab, r0!.id, c0!.id, {
      bg: "#4CAF50",
      color: "#FFFFFF",
      bold: true,
      fontSize: 14,
    });
    expect(getCellStyle(tab.rows[0]!.cells[c0!.id])?.bg).toBe("#4CAF50");
    tab = mergeSheetCells(tab, {
      startRowId: r0!.id,
      startColId: c0!.id,
      endRowId: r1!.id,
      endColId: c1!.id,
    });
    expect(isCoveredCell(tab, r1!.id, c1!.id)).toBe(true);
    tab = setSheetCell(tab, r1!.id, c1!.id, "via-cover");
    expect(getCellValue(tab.rows[0]!.cells[c0!.id])).toBe("via-cover");
    const un = unmergeSheetCells(tab, r1!.id, c0!.id);
    expect(un.removed).not.toBeNull();
    tab = un.tab;
    expect(tab.merges ?? []).toHaveLength(0);

    tab = mergeSheetCells(tab, {
      startRowId: r0!.id,
      startColId: c0!.id,
      endRowId: r0!.id,
      endColId: c1!.id,
    });
    const del = removeSheetColumns(tab, [c1!.id]);
    expect(del.tab.merges ?? []).toHaveLength(0);
  });
});
