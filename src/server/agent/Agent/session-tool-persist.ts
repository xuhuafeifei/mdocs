/**
 * 哪些 tool 结果写入 session jsonl，供下一轮 hydrate 复用。
 * 读类：全文可落盘；写类：只落短「请重读」提示，避免增肥。
 */

export const SESSION_PERSIST_TOOL_NAMES = [
  "get_document",
  "web_search",
  "web_fetch",
  "overwrite_document",
  "append_document",
  "replace_document_markdown",
] as const;

export type SessionPersistToolName = (typeof SESSION_PERSIST_TOOL_NAMES)[number];

const PERSIST_SET = new Set<string>(SESSION_PERSIST_TOOL_NAMES);

const WRITE_PERSIST_TOOLS = new Set([
  "overwrite_document",
  "append_document",
  "replace_document_markdown",
]);

export function shouldPersistToolResult(toolName: string): boolean {
  return PERSIST_SET.has(String(toolName ?? "").trim());
}

export function isWritePersistTool(toolName: string): boolean {
  return WRITE_PERSIST_TOOLS.has(String(toolName ?? "").trim());
}

/** 写成功后塞进 tool result / session 的短提示（不含正文） */
export function documentChangedNotice(params: {
  documentId: string;
  headCommitId: string | null;
  displayName?: string;
}): string {
  const name = String(params.displayName ?? "").trim() || params.documentId;
  return (
    `DOCUMENT_CHANGED documentId=${params.documentId} headCommitId=${params.headCommitId ?? "null"} displayName=${name}\n` +
    `正文已在服务端更新。此前 get_document 结果已过期；若还要基于正文继续，必须重新调用 get_document。`
  );
}

/** 从 pi tool_execution_end.result（asToolResult 形态）抽出给模型看的文本 */
export function extractToolResultText(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result;
  if (typeof result !== "object") return String(result);
  const r = result as { content?: unknown; details?: unknown };
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
  if (r.details !== undefined) {
    return typeof r.details === "string"
      ? r.details
      : JSON.stringify(r.details, null, 2);
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function normalizeToolArguments(args: unknown): Record<string, unknown> {
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

/** session 落盘用：写工具只保留 documentId（+ find 预览），不含全文 */
export function slimPersistArguments(
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (!isWritePersistTool(toolName)) return args;
  const documentId = String(args.documentId ?? "").trim();
  const out: Record<string, unknown> = {};
  if (documentId) out.documentId = documentId;
  if (toolName === "replace_document_markdown" && typeof args.find === "string") {
    const find = args.find;
    out.findPreview = find.length > 80 ? `${find.slice(0, 80)}…` : find;
  }
  return out;
}

/**
 * session 落盘用：写工具优先用 details.notice；失败则短错误；成功无 notice 时合成提示。
 */
export function slimPersistResultText(toolName: string, result: unknown): string {
  if (!isWritePersistTool(toolName)) {
    return extractToolResultText(result);
  }
  const details =
    result && typeof result === "object"
      ? (result as { details?: unknown }).details
      : undefined;
  if (details && typeof details === "object") {
    const d = details as Record<string, unknown>;
    if (typeof d.notice === "string" && d.notice.trim()) {
      return d.notice.trim();
    }
    const status = String(d.status ?? "");
    const documentId = String(d.documentId ?? "").trim();
    const overwritten = d.overwritten === true || status === "overwritten";
    const appended = status === "appended";
    const replaced = status === "replaced" || d.replaced === true;
    if (overwritten || appended || replaced) {
      return documentChangedNotice({
        documentId: documentId || "unknown",
        headCommitId:
          typeof d.headCommitId === "string" ? d.headCommitId : null,
        displayName: typeof d.displayName === "string" ? d.displayName : undefined,
      });
    }
    // 取消/超时等：短 JSON，不含 content
    return JSON.stringify({
      status: d.status ?? null,
      documentId: documentId || null,
      overwritten: d.overwritten ?? false,
      message: typeof d.message === "string" ? d.message : undefined,
    });
  }
  const full = extractToolResultText(result);
  return full.length > 500 ? `${full.slice(0, 500)}…` : full;
}
