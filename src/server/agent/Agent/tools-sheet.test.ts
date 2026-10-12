import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../../db/schema.js";
import {
  createEmptySheetDocument,
  serializeSheetDocument,
} from "../../../shared/sheetDocument.js";

const testDbRef = vi.hoisted(() => ({ db: null as Database.Database | null }));

const fileStoreMocks = vi.hoisted(() => ({
  lastWriteContent: "",
  reset() {
    fileStoreMocks.lastWriteContent = "";
  },
}));

vi.mock("../../db/connection.js", () => ({
  getDb: () => testDbRef.db,
}));

vi.mock("../../storage/file-store.js", () => ({
  writeDocument: (_domainId: string, _relativePath: string, content: string) => {
    fileStoreMocks.lastWriteContent = content;
    return { contentHash: "mock-hash", bytes: content.length };
  },
  readDocument: () => ({
    content: fileStoreMocks.lastWriteContent || "",
    contentHash: "mock-hash",
  }),
  writeCommitBlob: () => ({ blobRef: "ab/mock", bytes: 0 }),
  deleteDocumentFile: () => {},
  renameDocumentFile: () => {},
  sha256: () => "mock-hash",
}));

import { Permission } from "../../access/access-control.js";
import { createDocument } from "../../documents/document.service.js";
import {
  sheetAddSheetTool,
  sheetDeleteColumnsTool,
  sheetDeleteRowsTool,
  sheetDeleteSheetTool,
  sheetGetSchemaTool,
  sheetInsertRowsTool,
  sheetListRowsTool,
  sheetMergeCellsTool,
  sheetOverwriteTool,
  sheetRenameColumnTool,
  sheetSetCellsTool,
  sheetUnmergeCellsTool,
  sheetUpsertRowTool,
} from "./tools-sheet.js";
import { FILE_TYPE } from "../../../shared/file-types.js";

const OWNER = "owner-sheet-1";

async function runTool(
  tool: { execute: Function },
  params: Record<string, unknown>,
) {
  return tool.execute("call-1", params, undefined, undefined);
}

beforeAll(() => {
  const db = new Database(":memory:");
  applySchema(db);
  testDbRef.db = db;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("public-domain", "公开域", OWNER, now, now, "public");
});

afterEach(() => {
  const db = testDbRef.db!;
  db.exec("DELETE FROM commit_parents");
  db.exec("DELETE FROM document_commits");
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM audit_logs");
  fileStoreMocks.reset();
});

function createSheet() {
  const content = serializeSheetDocument(
    createEmptySheetDocument({ columnCount: 2, rowCount: 1 }),
  );
  fileStoreMocks.lastWriteContent = content;
  return createDocument({
    actorVisitorId: OWNER,
    fileName: "budget.sheet",
    content,
    fileType: FILE_TYPE.SHEET,
    domainId: "public-domain",
    permission: Permission.PUBLIC_WRITE,
  });
}

describe("sheet agent tools (workbook)", () => {
  it("multi-sheet + row/cell ops", async () => {
    const created = createSheet();
    const deps = { visitorId: OWNER, onEvent: () => {} };

    const schema = (await runTool(sheetGetSchemaTool(deps), {
      documentId: created.documentId,
    })).details as {
      sheets: Array<{ name: string }>;
      columns: Array<{ id: string; name: string }>;
      rowCount: number;
    };
    expect(schema.sheets).toHaveLength(1);
    expect(schema.rowCount).toBe(1);
    const colName = schema.columns[0]!.name;

    const added = (await runTool(sheetAddSheetTool(deps), {
      documentId: created.documentId,
      name: "欲望",
    })).details as { sheet: { name: string }; sheets: unknown[] };
    expect(added.sheet.name).toBe("欲望");
    expect(added.sheets).toHaveLength(2);

    const listed = (await runTool(sheetListRowsTool(deps), {
      documentId: created.documentId,
      sheet: "Sheet1",
    })).details as {
      rows: Array<{ rowId: string; cells: Record<string, string> }>;
      sheet: { name: string };
    };
    expect(listed.sheet.name).toBe("Sheet1");
    const rowId = listed.rows[0]!.rowId;

    const setResult = (await runTool(sheetSetCellsTool(deps), {
      documentId: created.documentId,
      sheet: "Sheet1",
      updates: [{ rowId, column: colName, value: "42" }],
    })).details as { status: string; applied: number };
    expect(setResult.status).toBe("updated");
    expect(setResult.applied).toBe(1);

    const upserted = (await runTool(sheetUpsertRowTool(deps), {
      documentId: created.documentId,
      sheet: "欲望",
      cells: [{ column: "列1", value: "新行" }],
    })).details as { created: boolean; rowId: string; sheet: { name: string } };
    expect(upserted.created).toBe(true);
    expect(upserted.sheet.name).toBe("欲望");

    const renamed = (await runTool(sheetRenameColumnTool(deps), {
      documentId: created.documentId,
      sheet: "Sheet1",
      column: colName,
      name: "金额",
    })).details as { status: string; name: string };
    expect(renamed.name).toBe("金额");

    const delRow = (await runTool(sheetDeleteRowsTool(deps), {
      documentId: created.documentId,
      sheet: "欲望",
      rowIds: [upserted.rowId],
    })).details as { removed: string[] };
    expect(delRow.removed).toEqual([upserted.rowId]);

    const delCol = (await runTool(sheetDeleteColumnsTool(deps), {
      documentId: created.documentId,
      sheet: "Sheet1",
      columns: [schema.columns[1]!.name],
    })).details as { columnCount: number };
    expect(delCol.columnCount).toBe(1);

    const delSheet = (await runTool(sheetDeleteSheetTool(deps), {
      documentId: created.documentId,
      sheet: "欲望",
    })).details as { sheets: unknown[] };
    expect(delSheet.sheets).toHaveLength(1);
  });

  it("rejects non-sheet documents", async () => {
    const md = createDocument({
      actorVisitorId: OWNER,
      fileName: "a.md",
      content: "hi",
      contentFormat: "markdown",
      domainId: "public-domain",
    });
    const tool = sheetGetSchemaTool({ visitorId: OWNER, onEvent: () => {} });
    await expect(
      runTool(tool, { documentId: md.documentId }),
    ).rejects.toThrow(/NOT_A_SHEET/);
  });

  it("insert_rows and overwrite", async () => {
    const created = createSheet();
    const deps = { visitorId: OWNER, onEvent: () => {} };

    const schema = (await runTool(sheetGetSchemaTool(deps), {
      documentId: created.documentId,
    })).details as { columns: Array<{ name: string }>; rowCount: number };
    const col = schema.columns[0]!.name;

    const inserted = (await runTool(sheetInsertRowsTool(deps), {
      documentId: created.documentId,
      rows: [
        { cells: [{ column: col, value: "a" }] },
        { cells: [{ column: col, value: "b" }] },
      ],
    })).details as { inserted: number; rowIds: string[]; rowCount: number };
    expect(inserted.inserted).toBe(2);
    expect(inserted.rowIds).toHaveLength(2);
    expect(inserted.rowCount).toBe(schema.rowCount + 2);

    const overwritten = (await runTool(sheetOverwriteTool(deps), {
      documentId: created.documentId,
      columns: ["姓名", "分数"],
      rows: [
        ["甲", "1"],
        ["乙", "2"],
      ],
    })).details as { columnCount: number; rowCount: number; status: string };
    expect(overwritten.status).toBe("updated");
    expect(overwritten.columnCount).toBe(2);
    expect(overwritten.rowCount).toBe(2);
  });

  it("sheet_merge_cells and sheet_unmerge_cells", async () => {
    const content = serializeSheetDocument(
      createEmptySheetDocument({ columnCount: 2, rowCount: 2 }),
    );
    fileStoreMocks.lastWriteContent = content;
    const created = createDocument({
      actorVisitorId: OWNER,
      fileName: "merge.sheet",
      content,
      fileType: FILE_TYPE.SHEET,
      domainId: "public-domain",
      permission: Permission.PUBLIC_WRITE,
    });
    const deps = { visitorId: OWNER, onEvent: () => {} };

    const listed = (await runTool(sheetListRowsTool(deps), {
      documentId: created.documentId,
    })).details as {
      rows: Array<{ rowId: string }>;
      columns: Array<{ name: string }>;
    };
    const r0 = listed.rows[0]!.rowId;
    const r1 = listed.rows[1]!.rowId;
    const c0 = listed.columns[0]!.name;
    const c1 = listed.columns[1]!.name;

    const merged = (await runTool(sheetMergeCellsTool(deps), {
      documentId: created.documentId,
      startRowId: r0,
      startColumn: c0,
      endRowId: r1,
      endColumn: c1,
    })).details as { status: string; merge: { startRowId: string } | null };
    expect(merged.status).toBe("updated");
    expect(merged.merge?.startRowId).toBe(r0);

    const unmerged = (await runTool(sheetUnmergeCellsTool(deps), {
      documentId: created.documentId,
      rowId: r1,
      column: c1,
    })).details as { status: string };
    expect(unmerged.status).toBe("updated");
  });
});
