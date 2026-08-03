import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createAccountTools } from "./tools-account.js";
import type { ChoiceToolHooks } from "./tools-choice.js";

/** 本轮请求里前端带来的帮写 buffer（不在磁盘） */
export type CodingDocContext = {
  documentId: string | null;
  /** 用户已接受 + 手改后的当前工作稿 */
  workingMarkdown: string;
  /** 进场快照 */
  baseMarkdown: string;
};

const WORKING_DOC_MAX_CHARS = 50_000;

function asToolResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function clipMarkdown(md: string): { text: string; truncated: boolean; charCount: number } {
  const charCount = md.length;
  if (charCount <= WORKING_DOC_MAX_CHARS) {
    return { text: md, truncated: false, charCount };
  }
  return {
    text: md.slice(0, WORKING_DOC_MAX_CHARS) + "\n\n…(truncated)",
    truncated: true,
    charCount,
  };
}

/** coding 模式专用：读/写前端 MD buffer，不写磁盘 */
export function createCodingWriteTools(ctx: CodingDocContext): AgentTool[] {
  return [
    {
      name: "get_working_document",
      label: "读取帮写工作稿",
      description:
        "读取本轮帮写工作台中的文章：进场快照（base）与当前工作稿（working，含已接受的修改）。改稿前应先调用。内容来自本次请求，不是服务器磁盘。",
      parameters: Type.Object({
        which: Type.Optional(
          Type.Union([Type.Literal("working"), Type.Literal("base"), Type.Literal("both")], {
            description: "读哪一份；默认 both",
          }),
        ),
      }),
      execute: async (_id, params) => {
        const which =
          (params as { which?: "working" | "base" | "both" }).which ?? "both";
        const working = clipMarkdown(ctx.workingMarkdown);
        const base = clipMarkdown(ctx.baseMarkdown);
        const payload: Record<string, unknown> = {
          documentId: ctx.documentId,
          source: "request_body",
        };
        if (which === "working" || which === "both") {
          payload.workingMarkdown = working.text;
          payload.workingTruncated = working.truncated;
          payload.workingCharCount = working.charCount;
        }
        if (which === "base" || which === "both") {
          payload.baseMarkdown = base.text;
          payload.baseTruncated = base.truncated;
          payload.baseCharCount = base.charCount;
        }
        return asToolResult(payload);
      },
    },
    {
      name: "set_markdown_document",
      label: "设置帮写正文",
      description:
        "用完整 Markdown 覆写帮写工作台右侧提案正文。不写入服务器文档；用户按段接受后才会写回。每次调用应给出当前完整 MD。改稿前请先 get_working_document。",
      parameters: Type.Object({
        markdown: Type.String({ description: "完整 Markdown 正文" }),
      }),
      execute: async (_id, params) => {
        const markdown = String((params as { markdown?: string }).markdown ?? "");
        return asToolResult({ markdown, applied: true });
      },
    },
  ];
}

/** coding：账号结构 tools + 读写 buffer tools（手册 tools 在 run 里另挂；不含服务端覆写） */
export function createCodingTools(
  visitorId: string,
  ctx: CodingDocContext,
  choiceHooks?: ChoiceToolHooks,
): AgentTool[] {
  return [
    ...createAccountTools(visitorId, choiceHooks, { withOverwrite: false }),
    ...createCodingWriteTools(ctx),
  ];
}
