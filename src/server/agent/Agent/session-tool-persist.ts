/**
 * 哪些 tool 结果写入 session jsonl，供下一轮 hydrate 复用。
 * 先落盘：读文档 + DeepSeek 网页搜索/抓取。
 */

export const SESSION_PERSIST_TOOL_NAMES = [
  "get_document",
  "web_search",
  "web_fetch",
] as const;

export type SessionPersistToolName = (typeof SESSION_PERSIST_TOOL_NAMES)[number];

const PERSIST_SET = new Set<string>(SESSION_PERSIST_TOOL_NAMES);

export function shouldPersistToolResult(toolName: string): boolean {
  return PERSIST_SET.has(String(toolName ?? "").trim());
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
