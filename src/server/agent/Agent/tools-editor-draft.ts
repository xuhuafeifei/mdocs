/**
 * 按需拉取浏览器当前编辑器/IndexedDB 草稿（SSE → 前端自动回传）。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  DEFAULT_EDITOR_DRAFT_TIMEOUT_MS,
  waitForEditorDraft,
} from "./editor-draft-wait.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

export function getEditorDraftTool({
  visitorId,
  onEvent,
  signal,
  uiDocumentId,
}: ToolDeps): AgentTool {
  return {
    name: "get_editor_draft",
    label: "读取本地草稿",
    description:
      "按需读取用户浏览器里当前打开文档的本地草稿（编辑器内存或 IndexedDB），返回 Markdown/HTML 文本，不是 Lexical。" +
      "合并冲突前若 local 是浏览器未发布稿，必须先调本工具拿 content 再 suggest_document_merge。" +
      "前端自动回传，无需用户确认。未打开该文 / 无草稿 / sheet → status=unavailable。",
    parameters: Type.Object({
      documentId: Type.Optional(
        Type.String({
          description: "文档 id；缺省用当前 UI 打开的文档",
        }),
      ),
    }),
    execute: async (_id, params) => {
      const raw = (params as { documentId?: string }).documentId?.trim();
      const documentId = raw || uiDocumentId?.trim() || "";
      if (!documentId) {
        return asToolResult({
          status: "unavailable",
          reason: "no_document_id",
        });
      }

      const { requestId, promise } = waitForEditorDraft({
        visitorId,
        documentId,
        timeoutMs: DEFAULT_EDITOR_DRAFT_TIMEOUT_MS,
        signal,
      });
      const expiresAt = new Date(
        Date.now() + DEFAULT_EDITOR_DRAFT_TIMEOUT_MS,
      ).toISOString();
      onEvent({
        type: "editor_draft_request",
        requestId,
        documentId,
        expiresAt,
      });

      const result = await promise;
      return asToolResult(result);
    },
  };
}

export function editorDraftTools(deps: ToolDeps): AgentTool[] {
  return [getEditorDraftTool(deps)];
}
