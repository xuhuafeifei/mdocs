import type { ManualSourceRef } from "./tools.js";

/** 推给路由 / 前端的流式片段（路由只负责写出 SSE） */
export type AgentStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "sources"; items: ManualSourceRef[] }
  | { type: "document_table"; title: string; rows: AgentDocumentTableRow[] }
  | {
      type: "document_card";
      documentId: string;
      title: string;
      path: string;
      preview: string;
    }
  | { type: "tool_notice"; toolName: string; text: string }
  /** 工具调用生命周期：running → done/error，聊天区展示可视化卡片 */
  | {
      type: "tool_call";
      toolCallId: string;
      toolName: string;
      label: string;
      status: "running" | "done" | "error";
      detail?: string;
    }
  | { type: "markdown_set"; markdown: string }
  | {
      type: "choice_card";
      requestId: string;
      title: string;
      options: string[];
      expiresAt: string;
    }
  | { type: "choice_expired"; requestId: string }
  | {
      type: "skill_form_card";
      requestId: string;
      mode: "create" | "update";
      title: string;
      currentName?: string;
      initialName: string;
      initialDescription: string;
      initialBody: string;
      expiresAt: string;
    }
  | { type: "skill_form_expired"; requestId: string }
  | {
      type: "open_coding";
      documentId: string;
      displayName: string;
    }
  | { type: "context_usage"; percent: number; used: number; limit: number }
  /** 账号工具改了文档树结构，前端应 re-fetch tree */
  | { type: "tree_changed"; reason: string }
  /** AI 覆写文档成功，前端若打开该文档应拉取最新内容 */
  | {
      type: "document_overwritten";
      documentId: string;
      headCommitId: string;
    }
  | { type: "done" }
  | { type: "error"; message: string }
  /** 后台 run 已创建；关闭面板不取消执行 */
  | {
      type: "run_started";
      runId: string;
      sessionId: string;
      deadlineAt: string;
    };

export interface AgentDocumentTableRow {
  documentId: string;
  title: string;
  summary: string;
}
