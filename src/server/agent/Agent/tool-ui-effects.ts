/**
 * tool_execution_end → 前端 SSE（与 tools 装配解耦；execute 仍在 tools-*.ts）
 */
import type { ManualSourceRef } from "./tools.js";
import type { AgentStreamEvent } from "./stream-events.js";

const TREE_MUTATING_TOOLS = new Set([
  "create_document",
  "create_folder",
  "move_document",
  "rename_document",
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
              ownerVisitorName?: string;
              updatedAt?: string;
            }>
          | undefined) ?? [];
      const rows = results
        .map((r) => ({
          documentId: String(r.documentId ?? "").trim(),
          title: String(r.displayName ?? "").trim() || "未命名文档",
          summary: [
            String(r.ownerVisitorName ?? "").trim(),
            String(r.updatedAt ?? "").trim(),
            String(r.snippet ?? "").trim(),
          ]
            .filter(Boolean)
            .join(" · "),
        }))
        .filter((r) => r.documentId);
      onEvent({
        type: "document_table",
        title: `搜索结果（${rows.length}）`,
        rows,
      });
      return;
    }

    if (event.toolName === "query_my_documents") {
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
        title: `目录（${rows.length}${details?.truncated ? "+" : ""}）`,
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
      const documentId = String(details?.documentId ?? "").trim();
      const name = String(details?.displayName ?? "").trim() || "未命名文档";
      if (documentId) {
        onEvent({
          type: "document_card",
          documentId,
          title: name,
          path: String(details?.relativePath ?? "").trim(),
          preview: "（新建空文档，点击打开）",
        });
      } else {
        onEvent({
          type: "tool_notice",
          toolName: event.toolName,
          text: `已创建空文档「${name}」`,
        });
      }
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

    if (event.toolName === "rename_document") {
      const name = String(details?.displayName ?? "").trim() || "文档";
      const path = String(details?.relativePath ?? "").trim();
      onEvent({
        type: "tool_notice",
        toolName: event.toolName,
        text: path ? `已重命名「${name}」→ ${path}` : `已重命名「${name}」`,
      });
      return;
    }

    if (
      event.toolName === "sheet_set_cells" ||
      event.toolName === "sheet_update_row" ||
      event.toolName === "sheet_append_rows" ||
      event.toolName === "sheet_insert_rows_at" ||
      event.toolName === "sheet_overwrite" ||
      event.toolName === "sheet_rename_column" ||
      event.toolName === "sheet_delete_rows" ||
      event.toolName === "sheet_delete_columns" ||
      event.toolName === "sheet_add_sheet" ||
      event.toolName === "sheet_rename_sheet" ||
      event.toolName === "sheet_delete_sheet" ||
      event.toolName === "sheet_set_cell_style" ||
      event.toolName === "sheet_merge_cells" ||
      event.toolName === "sheet_unmerge_cells"
    ) {
      const status = String(details?.status ?? "");
      if (status === "updated") {
        const name = String(details?.displayName ?? "").trim() || "表格";
        onEvent({
          type: "tool_notice",
          toolName: event.toolName,
          text: `已更新表格「${name}」`,
        });
        const documentId = String(details?.documentId ?? "");
        const headCommitId = String(details?.headCommitId ?? "");
        if (documentId && headCommitId) {
          onEvent({ type: "document_overwritten", documentId, headCommitId });
        }
        onEvent({ type: "tree_changed", reason: event.toolName });
      }
      return;
    }

    if (event.toolName === "overwrite_document") {
      const status = String(details?.status ?? "");
      if (status === "overwritten") {
        const documentId = String(details?.documentId ?? "").trim();
        const headCommitId = String(details?.headCommitId ?? "");
        if (documentId && headCommitId) {
          onEvent({ type: "document_overwritten", documentId, headCommitId });
        }
        if (documentId) {
          onEvent({
            type: "document_card",
            documentId,
            title: String(details?.displayName ?? "").trim() || "未命名文档",
            path: String(details?.relativePath ?? "").trim(),
            preview: "（已覆写，点击打开）",
          });
        }
        onEvent({ type: "tree_changed", reason: "overwrite_document" });
      }
      // 其它状态文案由 tool_call 卡片展示
      return;
    }

    if (
      event.toolName === "append_document" ||
      event.toolName === "replace_document_markdown"
    ) {
      const status = String(details?.status ?? "");
      const ok =
        status === "appended" ||
        status === "replaced" ||
        details?.replaced === true;
      if (ok) {
        const documentId = String(details?.documentId ?? "").trim();
        const headCommitId = String(details?.headCommitId ?? "");
        if (documentId && headCommitId) {
          onEvent({ type: "document_overwritten", documentId, headCommitId });
        }
        onEvent({ type: "tree_changed", reason: event.toolName });
      }
      return;
    }

    if (event.toolName === "get_working_document") {
      // tool_call 卡片已覆盖
      return;
    }

    if (event.toolName === "set_markdown_document") {
      const markdown = String(details?.markdown ?? "");
      onEvent({ type: "markdown_set", markdown });
      // 进度/摘要已由 tool_call 卡片展示；这里只推右侧提案，不再叠一句空 notice
    }

    if (event.toolName === "set_document_lexical_lines") {
      const documentId = String(details?.documentId ?? "").trim();
      const mode =
        details?.mode === "replace_all" ? "replace_all" : "patch_lines";
      const lines =
        details?.lines &&
        typeof details.lines === "object" &&
        !Array.isArray(details.lines)
          ? (details.lines as Record<string, string>)
          : {};
      const markdown =
        typeof details?.markdown === "string" ? details.markdown : undefined;
      if (documentId) {
        onEvent({
          type: "lexical_lines_set",
          documentId,
          mode,
          lines,
          ...(markdown != null ? { markdown } : {}),
        });
      }
    }

    if (
      event.toolName === "update_slot" ||
      event.toolName === "insert_after_slot" ||
      event.toolName === "remove_slot" ||
      event.toolName === "overwrite_all" ||
      event.toolName === "batch_update_slots"
    ) {
      const documentId = String(details?.documentId ?? "").trim();
      const op =
        details?.op === "update_slot" ||
        details?.op === "insert_after_slot" ||
        details?.op === "remove_slot" ||
        details?.op === "overwrite_all" ||
        details?.op === "batch_update_slots"
          ? details.op
          : (event.toolName as
              | "update_slot"
              | "insert_after_slot"
              | "remove_slot"
              | "overwrite_all"
              | "batch_update_slots");
      const slot =
        typeof details?.slot === "number" && Number.isFinite(details.slot)
          ? details.slot
          : undefined;
      const markdown =
        typeof details?.markdown === "string" ? details.markdown : undefined;
      const ranges = Array.isArray(details?.ranges)
        ? (details.ranges as Array<{
            start: number;
            end: number;
            markdown: string;
          }>)
        : undefined;
      if (documentId) {
        onEvent({
          type: "diff_slot_op",
          documentId,
          op,
          ...(slot != null ? { slot } : {}),
          ...(markdown != null ? { markdown } : {}),
          ...(ranges != null ? { ranges } : {}),
        });
      }
    }
  };
}
