/**
 * 工具调用时间线文案：给人看的 label / detail，供 SSE tool_call 使用。
 * 写类工具统一：meta 一行 + 正文预览（可滚动）。
 */

const TOOL_LABELS: Record<string, string> = {
  search_documents: "搜索文档",
  web_search: "网页搜索",
  web_fetch: "抓取网页",
  query_my_documents: "查询我的文档",
  list_tree: "浏览目录",
  get_document: "读取文档",
  create_document: "创建文档",
  create_folder: "创建文件夹",
  move_document: "移动文档",
  rename_document: "重命名文档",
  overwrite_document: "覆写文档",
  append_document: "追加文档正文",
  replace_document_markdown: "替换文档片段",
  get_editor_draft: "读取本地草稿",
  suggest_document_merge: "AI 合并文档冲突",
  suggest_document_merge_message: "生成合并说明",
  get_working_document: "读取帮写工作稿",
  set_markdown_document: "写入帮写正文",
  get_now: "获取当前时间",
  set_thinking_level: "设置思考强度",
  mdocs_manual_content: "查阅手册",
  sheet_get_schema: "读取表格结构",
  sheet_list_rows: "列出表格行",
  sheet_get_styles: "读取表格样式",
  sheet_set_cells: "更新表格单元格",
  sheet_update_row: "更新表格行",
  sheet_append_rows: "追加表格行",
  sheet_insert_rows_at: "在指定行后插入",
  sheet_overwrite: "覆写工作表",
  sheet_rename_column: "重命名列",
  sheet_delete_rows: "删除表格行",
  sheet_delete_columns: "删除表格列",
  sheet_add_sheet: "新增工作表",
  sheet_rename_sheet: "重命名工作表",
  sheet_delete_sheet: "删除工作表",
  sheet_set_cell_style: "设置单元格样式",
  sheet_merge_cells: "合并单元格",
  sheet_unmerge_cells: "取消合并",
};

/** 会写入实质内容、卡片里要给可滚动预览的工具 */
const WRITE_TOOLS = new Set([
  "overwrite_document",
  "append_document",
  "replace_document_markdown",
  "set_markdown_document",
  "sheet_overwrite",
  "sheet_set_cells",
  "sheet_update_row",
  "sheet_append_rows",
  "sheet_insert_rows_at",
]);

export function toolCallLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOLS.has(toolName);
}

function clip(text: string, max = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** 流式正文尾巴：卡片里「闪过」刚写下的内容 */
export function streamingBodyPreview(text: string, maxChars = 280): string {
  const t = text.replace(/\r\n/g, "\n");
  if (!t) return "";
  if (t.length <= maxChars) return t;
  const slice = t.slice(-maxChars);
  const nl = slice.indexOf("\n");
  const body = nl >= 0 && nl < 48 ? slice.slice(nl + 1) : slice;
  return `…${body}`;
}

/** 完成态从头截一段，方便扫读 */
export function headBodyPreview(text: string, maxChars = 480): string {
  const t = text.replace(/\r\n/g, "\n");
  if (!t) return "";
  if (t.length <= maxChars) return t;
  let slice = t.slice(0, maxChars);
  const nl = slice.lastIndexOf("\n");
  if (nl > maxChars * 0.45) slice = slice.slice(0, nl);
  return `${slice}\n…`;
}

/** 增量生长：尽量保留全文，卡片里跟着往下滚 */
export function growingBodyPreview(text: string, maxChars = 12000): string {
  const t = text.replace(/\r\n/g, "\n");
  if (!t) return "";
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n…`;
}

/** meta + 正文预览；有正文时换行，前端按多行开滚动 */
export function formatWriteToolDetail(
  meta: string,
  body: string,
  mode: "tail" | "head" | "grow",
): string {
  if (!body) return meta;
  const preview =
    mode === "tail"
      ? streamingBodyPreview(body)
      : mode === "grow"
        ? growingBodyPreview(body)
        : headBodyPreview(body);
  return preview ? `${meta}\n${preview}` : meta;
}

function cellsToLines(
  cells: unknown,
  label = "",
): string[] {
  if (!Array.isArray(cells)) return [];
  const lines: string[] = [];
  if (label) lines.push(label);
  for (const item of cells) {
    const c = asRecord(item);
    if (!c) continue;
    const col = String(c.column ?? c.name ?? "").trim();
    const val = c.value;
    const text =
      val === null || val === undefined
        ? ""
        : typeof val === "string"
          ? val
          : JSON.stringify(val);
    lines.push(col ? `${col}: ${text}` : text);
  }
  return lines;
}

function rowsToLines(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const lines: string[] = [];
  const max = Math.min(rows.length, 24);
  for (let i = 0; i < max; i++) {
    const row = rows[i];
    const rec = asRecord(row);
    if (rec && Array.isArray(rec.cells)) {
      const parts = cellsToLines(rec.cells).filter(Boolean);
      lines.push(parts.length ? parts.join(" · ") : `(空行 ${i + 1})`);
      continue;
    }
    if (Array.isArray(row)) {
      lines.push(row.map((c) => String(c ?? "")).join("\t"));
      continue;
    }
  }
  if (rows.length > max) lines.push(`…共 ${rows.length} 行`);
  return lines;
}

/** 从写工具 args / details 抽出可预览正文 */
export function writeToolBodyText(toolName: string, source: unknown): string {
  const a = asRecord(source);
  if (!a) return "";

  if (toolName === "set_markdown_document") {
    return String(a.markdown ?? "");
  }
  if (toolName === "overwrite_document") {
    return String(a.content ?? a.markdown ?? "");
  }
  if (toolName === "append_document") {
    return String(a.content ?? "");
  }
  if (toolName === "replace_document_markdown") {
    const find = String(a.find ?? "");
    const replace = String(a.replace ?? "");
    return `find:\n${find}\n\nreplace:\n${replace}`;
  }
  if (toolName === "sheet_overwrite") {
    const cols = Array.isArray(a.columns)
      ? a.columns.map((c) => String(c ?? ""))
      : [];
    const lines: string[] = [];
    if (cols.length) lines.push(cols.join("\t"));
    lines.push(...rowsToLines(a.rows));
    return lines.join("\n");
  }
  if (toolName === "sheet_set_cells" || toolName === "sheet_update_row") {
    return cellsToLines(a.cells).join("\n");
  }
  if (
    toolName === "sheet_append_rows" ||
    toolName === "sheet_insert_rows_at"
  ) {
    return rowsToLines(a.rows).join("\n");
  }
  return "";
}

function bodyLenHint(body: string): string {
  return body ? `约 ${body.length} 字` : "";
}

/** 参数仍在流式拼装时 */
export function toolCallPreparingDetail(
  toolName: string,
  args: unknown,
): string | undefined {
  if (!toolName || toolName === "tool") return "正在准备调用…";

  if (isWriteTool(toolName)) {
    const body = writeToolBodyText(toolName, args);
    const hint = bodyLenHint(body);
    const meta = hint ? `正在写入 · ${hint}` : "正在写入…";
    // 帮写/覆写正文：全文增量生长；表格等仍用尾巴闪过
    const mode =
      toolName === "set_markdown_document" ||
      toolName === "overwrite_document" ||
      toolName === "append_document" ||
      toolName === "replace_document_markdown"
        ? "grow"
        : "tail";
    return formatWriteToolDetail(meta, body, mode);
  }

  return "正在准备参数…";
}

/** 调用开始时：从 args 抽可滚动预览 */
export function toolCallDetailFromArgs(
  toolName: string,
  args: unknown,
): string | undefined {
  const a = asRecord(args);
  if (!a) return undefined;

  if (isWriteTool(toolName)) {
    const body = writeToolBodyText(toolName, a);
    if (toolName === "set_markdown_document") {
      const meta = body ? `写入中 · ${body.length} 字` : "写入中";
      // 执行中仍用 grow，避免从增量全文突然砍成开头截断
      return formatWriteToolDetail(meta, body, "grow");
    }
    if (toolName === "overwrite_document") {
      const id = String(a.documentId ?? "").trim();
      const parts = [
        "覆写中",
        id ? `文档 ${id.slice(0, 8)}…` : "",
        body ? `${body.length} 字` : "",
      ].filter(Boolean);
      return formatWriteToolDetail(parts.join(" · "), body, "grow");
    }
    const name = String(
      a.displayName ?? a.sheetName ?? a.documentId ?? "",
    ).trim();
    const meta = name ? `写入中 · ${clip(name)}` : "写入中";
    return formatWriteToolDetail(meta, body, "head");
  }

  if (toolName === "search_documents" || toolName === "web_search") {
    return (
      clip(String(a.query ?? a.keyword ?? a.q ?? "").trim()) || undefined
    );
  }

  if (toolName === "web_fetch") {
    return clip(String(a.url ?? "").trim()) || undefined;
  }

  if (
    toolName === "get_document" ||
    toolName === "move_document" ||
    toolName === "rename_document"
  ) {
    const id = String(a.documentId ?? "").trim();
    const name = String(a.displayName ?? a.newName ?? a.name ?? "").trim();
    return name || (id ? `文档 ${id.slice(0, 8)}…` : undefined);
  }

  if (toolName === "create_document" || toolName === "create_folder") {
    return (
      clip(
        String(a.displayName ?? a.name ?? a.path ?? a.relativePath ?? "").trim(),
      ) || undefined
    );
  }

  if (toolName.startsWith("sheet_")) {
    const name = String(
      a.displayName ?? a.sheetName ?? a.documentId ?? "",
    ).trim();
    return name ? clip(name) : undefined;
  }

  return undefined;
}

function previewFromFallback(fallback?: string): string {
  if (!fallback) return "";
  const nl = fallback.indexOf("\n");
  return nl >= 0 ? fallback.slice(nl + 1) : "";
}

/** 调用结束时：优先用 result.details；写工具保留可滚动正文 */
export function toolCallDetailFromResult(
  toolName: string,
  result: unknown,
  fallback?: string,
): string | undefined {
  const details = asRecord(asRecord(result)?.details) ?? asRecord(result);
  if (!details) return fallback;

  if (toolName === "set_markdown_document") {
    const md =
      writeToolBodyText(toolName, details) || previewFromFallback(fallback);
    if (md) {
      return formatWriteToolDetail(`已写入 · ${md.length} 字`, md, "grow");
    }
    return fallback ?? "已写入帮写正文";
  }

  if (toolName === "overwrite_document") {
    const status = String(details.status ?? "");
    const name = String(details.displayName ?? "").trim() || "文档";
    const body =
      writeToolBodyText(toolName, details) || previewFromFallback(fallback);
    if (status === "overwritten") {
      return formatWriteToolDetail(`已覆写「${name}」`, body, "grow");
    }
    if (status === "redirected_to_coding") return `「${name}」已打开帮写`;
    if (status === "rejected") {
      return String(details.message ?? "已拒绝").trim() || fallback;
    }
    return fallback;
  }

  if (isWriteTool(toolName) && toolName.startsWith("sheet_")) {
    const name = String(details.displayName ?? "").trim() || "表格";
    const body =
      writeToolBodyText(toolName, details) || previewFromFallback(fallback);
    return formatWriteToolDetail(`已更新「${name}」`, body, "head");
  }

  if (toolName === "get_now") {
    const local = String(details.local ?? "").trim();
    return local || fallback;
  }

  if (toolName === "get_document") {
    const name = String(details.displayName ?? "").trim();
    return name ? `已读「${name}」` : fallback;
  }

  if (toolName === "create_document") {
    const name = String(details.displayName ?? "").trim();
    return name ? `已创建「${name}」` : fallback;
  }

  if (toolName === "search_documents" || toolName === "web_search") {
    const results = details.results;
    const n = Array.isArray(results) ? results.length : undefined;
    const q = clip(String(details.query ?? "").trim(), 48);
    if (typeof n === "number") {
      return q ? `「${q}」· ${n} 条` : `找到 ${n} 条`;
    }
    return fallback;
  }

  if (toolName === "web_fetch") {
    const title = String(details.title ?? "").trim();
    const body = String(details.content ?? "").trim();
    const chars =
      typeof details.chars === "number" ? details.chars : body.length;
    const meta = title
      ? `已抓取「${clip(title)}」${chars ? ` · ${chars} 字` : ""}`
      : chars
        ? `已抓取 · ${chars} 字`
        : "已抓取";
    return formatWriteToolDetail(meta, body, "head");
  }

  if (toolName.startsWith("sheet_")) {
    const status = String(details.status ?? "");
    const name = String(details.displayName ?? "").trim() || "表格";
    if (status === "updated") return `已更新「${name}」`;
  }

  return fallback;
}
