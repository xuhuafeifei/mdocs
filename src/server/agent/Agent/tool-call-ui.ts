/**
 * 工具调用时间线文案：给人看的 label / detail，供 SSE tool_call 使用。
 */

const TOOL_LABELS: Record<string, string> = {
  search_documents: "搜索文档",
  query_my_documents: "查询我的文档",
  list_tree: "浏览目录",
  get_document: "读取文档",
  create_document: "创建文档",
  create_folder: "创建文件夹",
  move_document: "移动文档",
  rename_document: "重命名文档",
  overwrite_document: "覆写文档",
  get_working_document: "读取帮写工作稿",
  set_markdown_document: "写入帮写正文",
  get_now: "获取当前时间",
  mdocs_manual_content: "查阅手册",
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

export function toolCallLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

function firstNonEmptyLine(text: string): string {
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t) return t;
  }
  return "";
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

/** 调用开始时：从 args 抽一行给人看的上下文 */
export function toolCallDetailFromArgs(toolName: string, args: unknown): string | undefined {
  const a = asRecord(args);
  if (!a) return undefined;

  if (toolName === "set_markdown_document") {
    const md = String(a.markdown ?? "");
    const head = firstNonEmptyLine(md);
    const n = md.length;
    if (head) return `${clip(head)} · ${n} 字`;
    return n > 0 ? `${n} 字` : undefined;
  }

  if (toolName === "overwrite_document") {
    const content = String(a.content ?? a.markdown ?? "");
    const id = String(a.documentId ?? "").trim();
    const head = firstNonEmptyLine(content);
    const parts = [
      id ? `文档 ${id.slice(0, 8)}…` : "",
      head ? clip(head) : content ? `${content.length} 字` : "",
    ].filter(Boolean);
    return parts.join(" · ") || undefined;
  }

  if (toolName === "search_documents") {
    return (
      clip(String(a.query ?? a.keyword ?? a.q ?? "").trim()) || undefined
    );
  }

  if (toolName === "get_document" || toolName === "move_document" || toolName === "rename_document") {
    const id = String(a.documentId ?? "").trim();
    const name = String(a.displayName ?? a.newName ?? a.name ?? "").trim();
    return name || (id ? `文档 ${id.slice(0, 8)}…` : undefined);
  }

  if (toolName === "create_document" || toolName === "create_folder") {
    return (
      clip(String(a.displayName ?? a.name ?? a.path ?? a.relativePath ?? "").trim()) ||
      undefined
    );
  }

  if (toolName.startsWith("sheet_")) {
    const name = String(a.displayName ?? a.sheetName ?? a.documentId ?? "").trim();
    return name ? clip(name) : undefined;
  }

  return undefined;
}

/** 调用结束时：优先用 result.details 生成摘要 */
export function toolCallDetailFromResult(
  toolName: string,
  result: unknown,
  fallback?: string,
): string | undefined {
  const details = asRecord(asRecord(result)?.details) ?? asRecord(result);
  if (!details) return fallback;

  if (toolName === "set_markdown_document") {
    const md = String(details.markdown ?? "");
    const head = firstNonEmptyLine(md);
    if (head) return `已写入 · ${clip(head)} · ${md.length} 字`;
    if (md.length > 0) return `已写入 · ${md.length} 字`;
    return fallback ?? "已写入帮写正文";
  }

  if (toolName === "overwrite_document") {
    const status = String(details.status ?? "");
    const name = String(details.displayName ?? "").trim() || "文档";
    if (status === "overwritten") return `已覆写「${name}」`;
    if (status === "redirected_to_coding") return `「${name}」已打开帮写`;
    if (status === "rejected") return String(details.message ?? "已拒绝").trim() || fallback;
    return fallback;
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

  if (toolName === "search_documents") {
    const results = details.results;
    const n = Array.isArray(results) ? results.length : undefined;
    return typeof n === "number" ? `找到 ${n} 条` : fallback;
  }

  if (toolName.startsWith("sheet_")) {
    const status = String(details.status ?? "");
    const name = String(details.displayName ?? "").trim() || "表格";
    if (status === "updated") return `已更新「${name}」`;
  }

  return fallback;
}
