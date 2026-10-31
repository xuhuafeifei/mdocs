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
  /** 工具调用生命周期：preparing（参数流式中）→ running → done/error */
  | {
      type: "tool_call";
      toolCallId: string;
      toolName: string;
      label: string;
      status: "preparing" | "running" | "done" | "error";
      detail?: string;
      /** web_search 完成态：结构化结果供前端卡片展示 */
      webResults?: AgentWebSearchResults;
    }
  | { type: "markdown_set"; markdown: string }
  /** 智能助手按块提案（不写盘）；前端 LexicalDiff 审阅 */
  | {
      type: "lexical_lines_set";
      documentId: string;
      mode: "patch_lines" | "replace_all";
      lines: Record<string, string>;
      markdown?: string;
    }
  /** 智能助手 slot Diff（不写盘）；前端调 Lobe updateSlot / insertAfterSlot / removeSlot / overwriteAll / batch */
  | {
      type: "diff_slot_op";
      documentId: string;
      op:
        | "update_slot"
        | "insert_after_slot"
        | "remove_slot"
        | "overwrite_all"
        | "batch_update_slots";
      slot?: number;
      markdown?: string;
      ranges?: Array<{ start: number; end: number; markdown: string }>;
    }
  | {
      type: "choice_card";
      requestId: string;
      title: string;
      options: string[];
      expiresAt: string;
    }
  | { type: "choice_expired"; requestId: string }
  /** 前端静默取本地草稿并 POST 回传（无用户确认卡） */
  | {
      type: "editor_draft_request";
      requestId: string;
      documentId: string;
      expiresAt: string;
    }
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
  /**
   * 整篇改动先交前端审阅：前端确保打开的是目标文档，再把 markdown 落成 Diff。
   * 服务端此刻不写正文；用户确认后走正常发布链路。
   */
  | {
      type: "diff_proposal";
      documentId: string;
      displayName: string;
      fileType: string;
      markdown: string;
    }
  | { type: "context_usage"; percent: number; used: number; limit: number }
  /** 正在 LLM 压缩 session 历史 */
  | { type: "context_compacting" }
  /** 压缩完成（或跳过失败后用量不变时不发）；用于更新用量环 */
  | { type: "context_compacted"; percent: number; used: number; limit: number }
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
    }
  /** plugin-pipeline：submit_pipeline 交卷，供右栏节点渲染 */
  | {
      type: "pipeline_draft";
      draft: {
        yaml: string;
        valid: boolean;
        error?: string;
        model: string;
        notes?: string;
        trace?: Array<{
          tool: string;
          summary: string;
          ok: boolean;
          durationMs: number;
        }>;
      };
    }
  /** plugin-pipeline：Agent 触发安装后推任务态，供右栏轮询/展示 */
  | {
      type: "pipeline_job";
      scope: "system" | "tenant";
      id: string;
      yaml?: string;
      job: {
        id: string;
        pipelineId: string;
        pipelineName: string;
        scope: "system" | "tenant";
        action: "install" | "uninstall";
        status: "running" | "done" | "error";
        startedAt: string;
        finishedAt: string | null;
        error: string | null;
        steps: Array<{
          index: number;
          type: string;
          label: string;
          status: string;
          detail?: string;
          error?: string;
        }>;
        logs: Array<{
          ts: string;
          level: string;
          line: string;
          stepIndex?: number;
        }>;
      };
    };

export interface AgentDocumentTableRow {
  documentId: string;
  title: string;
  summary: string;
}

export type AgentWebSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  /** 长摘要，前端条目展开用 */
  summary?: string;
  /** needContent 时的正文，前端条目展开用 */
  content?: string;
  siteName?: string | null;
  siteIcon?: string | null;
  date?: string | null;
};

export type AgentWebSearchResults = {
  query: string;
  items: AgentWebSearchResultItem[];
};
