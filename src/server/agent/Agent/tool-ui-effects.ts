/**
 * tool_execution_end → 前端 SSE（与 tools 装配解耦；execute 仍在 tools-*.ts）
 */
import type { ManualSourceRef } from "./tools.js";
import type { AgentStreamEvent } from "./stream-events.js";

const TREE_MUTATING_TOOLS = new Set([
  "create_document",
  "create_folder",
  "move_document",
]);

export type ToolExecutionEndLike = {
  toolName: string;
  isError: boolean;
  result: unknown;
};

/**
 * 一次 chat 运行内复用：手册 sources 去重等状态挂在闭包。
 */
export function createToolUiEffectsHandler(onEvent: (event: AgentStreamEvent) => void) {
  const sourcesById = new Map<string, ManualSourceRef>();

  return (event: ToolExecutionEndLike): void => {
    if (event.isError) return;

    if (event.toolName === "mdocs_manual_content") {
      const source = (
        event.result as { details?: { source?: ManualSourceRef | null } } | null
      )?.details?.source;
      if (source?.url && !sourcesById.has(source.id)) {
        sourcesById.set(source.id, source);
        onEvent({ type: "sources", items: [...sourcesById.values()] });
      }
      return;
    }

    if (TREE_MUTATING_TOOLS.has(event.toolName)) {
      onEvent({ type: "tree_changed", reason: event.toolName });
    }

    const details = (event.result as { details?: Record<string, unknown> } | null)
      ?.details;

    if (event.toolName === "search_documents") {
      const results =
        (details?.results as
          | Array<{
              documentId?: string;
              displayName?: string;
              snippet?: string;
            }>
          | undefined) ?? [];
      const rows = results
        .map((r) => ({
          documentId: String(r.documentId ?? "").trim(),
          title: String(r.displayName ?? "").trim() || "未命名文档",
          summary: String(r.snippet ?? "").trim(),
        }))
        .filter((r) => r.documentId);
      onEvent({
        type: "document_table",
        title: `搜索结果（${rows.length}）`,
        rows,
      });
      return;
    }

    if (event.toolName === "list_my_documents") {
      const documents =
        (details?.documents as
          | Array<{
              documentId?: string;
              displayName?: string;
              relativePath?: string;
            }>
          | undefined) ?? [];
      const rows = documents
        .map((d) => ({
          documentId: String(d.documentId ?? "").trim(),
          title: String(d.displayName ?? "").trim() || "未命名文档",
          summary: String(d.relativePath ?? "").trim(),
        }))
        .filter((r) => r.documentId);
      onEvent({
        type: "document_table",
        title: `我的文档（${rows.length}）`,
        rows,
      });
      return;
    }

    if (event.toolName === "list_tree") {
      const items =
        (details?.items as
          | Array<{
              type?: string;
              documentId?: string;
              displayName?: string;
              name?: string;
              path?: string;
            }>
          | undefined) ?? [];
      const rows = items
        .map((it) => {
          const documentId = String(it.documentId ?? "").trim();
          const title =
            String(it.displayName ?? "").trim() ||
            String(it.name ?? "").trim() ||
            "未命名";
          const kind = it.type === "folder" ? "文件夹" : "文档";
          const path = String(it.path ?? "").trim();
          return {
            documentId,
            title: it.type === "folder" ? `[目录] ${title}` : title,
            summary: path ? `${kind} · ${path}` : kind,
          };
        })
        .filter((r) => r.documentId);
      onEvent({
        type: "document_table",
        title: `域树（${rows.length}${details?.truncated ? "+" : ""}）`,
        rows,
      });
      return;
    }

    if (event.toolName === "get_document") {
      const documentId = String(details?.documentId ?? "").trim();
      if (!documentId) return;
      const content = String(details?.content ?? "");
      const preview =
        content.length > 280 ? `${content.slice(0, 280)}…` : content;
      onEvent({
        type: "document_card",
        documentId,
        title: String(details?.displayName ?? "").trim() || "未命名文档",
        path: String(details?.relativePath ?? "").trim(),
        preview,
      });
      return;
    }

    if (event.toolName === "create_document") {
      const name = String(details?.displayName ?? "").trim() || "未命名文档";
      onEvent({
        type: "tool_notice",
        toolName: event.toolName,
        text: `已创建空文档「${name}」`,
      });
      return;
    }

    if (event.toolName === "create_folder") {
      const path = String(details?.path ?? "").trim();
      onEvent({
        type: "tool_notice",
        toolName: event.toolName,
        text: path ? `已创建文件夹「${path}」` : "已创建文件夹",
      });
      return;
    }

    if (event.toolName === "move_document") {
      const name = String(details?.displayName ?? "").trim() || "文档";
      const path = String(details?.relativePath ?? "").trim();
      onEvent({
        type: "tool_notice",
        toolName: event.toolName,
        text: path ? `已移动「${name}」→ ${path}` : `已移动「${name}」`,
      });
      return;
    }

    if (event.toolName === "overwrite_document") {
      const status = String(details?.status ?? "");
      const name = String(details?.displayName ?? "").trim() || "文档";
      if (status === "overwritten") {
        onEvent({
          type: "tool_notice",
          toolName: event.toolName,
          text: `已覆写「${name}」`,
        });
        const documentId = String(details?.documentId ?? "");
        const headCommitId = String(details?.headCommitId ?? "");
        if (documentId && headCommitId) {
          onEvent({ type: "document_overwritten", documentId, headCommitId });
        }
        onEvent({ type: "tree_changed", reason: "overwrite_document" });
      } else if (status === "redirected_to_coding") {
        onEvent({
          type: "tool_notice",
          toolName: event.toolName,
          text: `「${name}」已打开帮写`,
        });
      }
      return;
    }

    if (event.toolName === "get_working_document") {
      onEvent({
        type: "tool_notice",
        toolName: event.toolName,
        text: "读取帮写工作稿",
      });
      return;
    }

    if (event.toolName === "set_markdown_document") {
      const markdown = String(details?.markdown ?? "");
      onEvent({ type: "markdown_set", markdown });
      onEvent({
        type: "tool_notice",
        toolName: event.toolName,
        text: "设置帮写正文",
      });
    }
  };
}
