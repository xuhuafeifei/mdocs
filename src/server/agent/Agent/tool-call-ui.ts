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
  list_document_commits: "列出文档历史",
  get_document_commit: "读取历史版本",
  get_document_lexical_lines: "按块读取文档",
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
  set_document_lexical_lines: "按块设置提案",
  update_slot: "更新文档块",
  insert_after_slot: "在块后插入",
  remove_slot: "删除文档块",
  batch_update_slots: "批量更新文档块",
  overwrite_all: "整篇 Diff 提案",
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
  exec: "探测执行命令",
  download: "临时下载",
  fetch_page: "抓取说明页",
  list_dir: "列临时目录",
  read_file: "读临时文件",
  submit_pipeline: "提交流水线草稿",
  install_pipeline: "安装流水线",
  run_plugin_cli: "运行插件 CLI",
  list_plugin_home: "列出插件目录",
  read_plugin_content: "读取插件文本",
  query_skill: "查询私人 Skill",
};

/** 会写入实质内容、卡片里要给可滚动预览的工具 */
const WRITE_TOOLS = new Set([
  "overwrite_document",
  "append_document",
  "replace_document_markdown",
  "set_markdown_document",
  "set_document_lexical_lines",
  "update_slot",
  "insert_after_slot",
  "remove_slot",
  "batch_update_slots",
  "overwrite_all",
  "sheet_overwrite",
  "sheet_set_cells",
  "sheet_update_row",
  "sheet_append_rows",
  "sheet_insert_rows_at",
]);

export function toolCallLabel(toolName: string): string {
  if (toolName.startsWith("mcp__")) {
    const rest = toolName.slice("mcp__".length);
    const sep = rest.indexOf("__");
    if (sep > 0) {
      const server = rest.slice(0, sep);
      const tool = rest.slice(sep + 2);
      return `MCP · ${server}/${tool}`;
    }
    return `MCP · ${rest || toolName}`;
  }
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

/** 时间线标题只展示 ≤72 字的 hint，超出整段会被收成折叠正文 */
function titleHint(text: string, max = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function formatArgValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object).length}}`;
  }
  return "";
}

/** 把工具入参收成一行，供准备中的时间线直接看到 */
function formatArgsPreview(args: unknown): string {
  if (typeof args === "string") return args.trim();
  const record = asRecord(args);
  if (!record) return "";
  return Object.entries(record)
    .map(([key, value]) => {
      const shown = formatArgValue(value);
      return shown ? `${key}=${shown}` : "";
    })
    .filter(Boolean)
    .join(" ");
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
  if (
    toolName === "update_slot" ||
    toolName === "insert_after_slot" ||
    toolName === "overwrite_all"
  ) {
    return String(a.markdown ?? "");
  }
  if (toolName === "batch_update_slots") {
    const ranges = Array.isArray(a.ranges) ? a.ranges : [];
    return ranges
      .map((raw, i) => {
        const r = asRecord(raw);
        if (!r) return `range[${i}]`;
        const start = r.start;
        const end = r.end;
        const md = String(r.markdown ?? "");
        return `[${start},${end}]\n${md}`;
      })
      .join("\n\n---\n\n");
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

  const argsText = formatArgsPreview(args);
  if (!argsText) return "正在准备参数…";
  return titleHint(`正在准备参数 · ${argsText}`);
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
    toolName === "list_document_commits" ||
    toolName === "get_document_commit" ||
    toolName === "move_document" ||
    toolName === "rename_document"
  ) {
    const id = String(a.documentId ?? "").trim();
    const name = String(a.displayName ?? a.newName ?? a.name ?? "").trim();
    const commit = String(a.commitId ?? "").trim();
    if (toolName === "get_document_commit" && commit) {
      return name
        ? `${name} @ ${commit.slice(0, 8)}…`
        : `版本 ${commit.slice(0, 8)}…`;
    }
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

  if (toolName === "run_plugin_cli") {
    return formatCliInvocationDetail(a, "运行中");
  }
  if (toolName === "exec") {
    return formatCliInvocationDetail(a, "探测中");
  }
  if (toolName === "list_plugin_home") {
    const name = String(a.plugin_name ?? "").trim();
    const sub = String(a.path ?? "").trim();
    if (!name) return "列出插件目录…";
    return sub ? `列出 ${name}/${sub}` : `列出 ${name}/`;
  }
  if (toolName === "read_plugin_content") {
    const name = String(a.plugin_name ?? "").trim();
    const file = String(a.path ?? "").trim();
    if (name && file) return `读取文本 ${name}/${file}`;
    return file ? `读取文本 ${file}` : "读取插件文本…";
  }
  if (toolName === "install_pipeline") {
    const id = String(a.id ?? a.plugin_id ?? "").trim();
    return id ? `安装 ${id}…` : "安装流水线…";
  }
  if (toolName === "download" || toolName === "fetch_page") {
    return clip(String(a.url ?? "").trim()) || undefined;
  }

  return titleHint(formatArgsPreview(a)) || undefined;
}

function formatCliInvocationDetail(
  a: Record<string, unknown>,
  phase: string,
): string {
  const plugin = String(a.plugin_name ?? "").trim();
  const cmd = String(a.command ?? "").trim();
  const args = Array.isArray(a.args)
    ? a.args.map((x) => String(x)).filter(Boolean)
    : [];
  const cwd = String(a.cwd ?? "").trim();
  const cwdRoot = String(a.cwd_root ?? "").trim();
  const line = [cmd, ...args].filter(Boolean).join(" ");
  const parts = [
    phase,
    plugin ? `插件 ${plugin}` : "",
    line ? `$ ${clip(line, 120)}` : "",
    cwd ? `cwd=${cwdRoot === "data" ? "data/" : ""}${cwd}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || phase;
}

function formatCliResultDetail(
  details: Record<string, unknown>,
  fallback?: string,
): string {
  const ok = details.ok !== false && details.exitCode !== undefined
    ? Number(details.exitCode) === 0
    : details.ok !== false;
  const code =
    typeof details.exitCode === "number" ? details.exitCode : null;
  const cmd = String(details.command ?? "").trim();
  const args = Array.isArray(details.args)
    ? details.args.map((x) => String(x)).filter(Boolean)
    : [];
  const cwd = String(details.cwd ?? "").trim();
  const stdout = String(details.stdout ?? "").trim();
  const stderr = String(details.stderr ?? "").trim();
  const line = [cmd, ...args].filter(Boolean).join(" ");
  const meta = [
    ok ? "完成" : "失败",
    code != null ? `exit ${code}` : "",
    line ? `$ ${clip(line, 100)}` : "",
    cwd ? clip(cwd, 64) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const body = [stdout && `── stdout ──\n${stdout}`, stderr && `── stderr ──\n${stderr}`]
    .filter(Boolean)
    .join("\n\n");
  if (body) return formatWriteToolDetail(meta || "已执行", body, "head");
  return meta || fallback || (ok ? "已执行" : "执行失败");
}

function previewFromFallback(fallback?: string): string {
  if (!fallback) return "";
  const nl = fallback.indexOf("\n");
  return nl >= 0 ? fallback.slice(nl + 1) : "";
}

/** 失败态：抽出可读错误文案给前端卡片 */
export function toolCallErrorDetail(
  result: unknown,
  fallback?: string,
): string {
  const text = extractErrorText(result).trim();
  if (text) return text.length > 2400 ? `${text.slice(0, 2400)}…` : text;
  const fb = String(fallback ?? "").trim();
  return fb || "工具执行失败";
}

function extractErrorText(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result;
  if (typeof result !== "object") return String(result);
  const r = result as {
    content?: unknown;
    details?: unknown;
    message?: unknown;
    error?: unknown;
  };
  if (typeof r.message === "string" && r.message.trim()) return r.message;
  if (typeof r.error === "string" && r.error.trim()) return r.error;
  if (r.error && typeof r.error === "object") {
    const msg = (r.error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (Array.isArray(r.content)) {
    const parts = r.content
      .map((c) => {
        if (!c || typeof c !== "object") return "";
        const block = c as { type?: string; text?: unknown };
        if (block.type === "text" && typeof block.text === "string") return block.text;
        return "";
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join("\n");
  }
  if (typeof r.details === "string" && r.details.trim()) return r.details;
  if (r.details && typeof r.details === "object") {
    const d = r.details as { message?: unknown; error?: unknown };
    if (typeof d.message === "string" && d.message.trim()) return d.message;
    if (typeof d.error === "string" && d.error.trim()) return d.error;
    try {
      return JSON.stringify(r.details, null, 2);
    } catch {
      /* ignore */
    }
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
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
    if (status === "proposed_as_diff") return `「${name}」已生成 Diff 待确认`;
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

  if (toolName === "list_document_commits") {
    const n =
      typeof details.total === "number"
        ? details.total
        : Array.isArray(details.commits)
          ? details.commits.length
          : undefined;
    return typeof n === "number" ? `历史 ${n} 版` : fallback;
  }

  if (toolName === "get_document_commit") {
    const msg = String(details.message ?? "").trim();
    const id = String(details.commitId ?? "").trim();
    if (msg) return `已读历史「${clip(msg, 32)}」`;
    return id ? `已读历史 ${id.slice(0, 8)}…` : fallback;
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

  if (toolName === "run_plugin_cli" || toolName === "exec") {
    return formatCliResultDetail(details, fallback);
  }

  if (toolName === "list_plugin_home") {
    const name = String(details.plugin_name ?? "").trim();
    const tree = String(details.tree ?? "").trim();
    const entries = Array.isArray(details.entries) ? details.entries : [];
    const body =
      tree ||
      entries
        .slice(0, 80)
        .map((e) => (typeof e === "string" ? e : String(e)))
        .join("\n");
    const meta = name
      ? `插件目录 ${name} · ${entries.length} 项`
      : `插件目录 · ${entries.length} 项`;
    return formatWriteToolDetail(meta, body, "head");
  }

  if (toolName === "read_plugin_content") {
    const pathLabel = String(details.path ?? "").trim() || "文件";
    const content = String(details.content ?? "");
    const truncated = details.truncated === true;
    const bytes =
      typeof details.bytes === "number" ? details.bytes : content.length;
    const meta = [
      `已读 ${pathLabel}`,
      `${bytes} bytes`,
      truncated ? "已截断" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return formatWriteToolDetail(meta, content, "head");
  }

  if (toolName === "install_pipeline") {
    const id = String(details.id ?? details.plugin_id ?? "").trim();
    const status = String(details.status ?? details.jobStatus ?? "").trim();
    if (details.ok === false || details.error) {
      return (
        String(details.error ?? details.message ?? "安装失败").trim() ||
        fallback
      );
    }
    return [status || "已触发安装", id ? id : ""].filter(Boolean).join(" · ");
  }

  return fallback;
}
