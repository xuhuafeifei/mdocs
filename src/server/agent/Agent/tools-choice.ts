import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  DEFAULT_CHOICE_TIMEOUT_MS,
  waitForUserChoice,
} from "./choice-pending.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

function normalizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** 向用户展示选项并阻塞等待内容字符串选择（可自由输入） */
export function askUserChoiceTool({
  visitorId,
  onEvent,
  signal,
}: ToolDeps): AgentTool {
  return {
    name: "ask_user_choice",
    label: "请用户选择",
    description:
      "向用户展示一张选择卡片：options 为内容字符串列表（你自填、不固定）。调用后会阻塞直到用户点选某项、自行输入一段文字、超时或取消。需要用户做二选一/多选一时必须用本工具，禁止只在口头上问。返回 JSON 含 status 与 choice（选中的内容字符串）。",
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "卡片标题/问题" })),
      options: Type.Array(Type.String({ description: "一个可点选项的文案" }), {
        description: "至少 2 个选项文案",
        minItems: 2,
      }),
      timeoutMs: Type.Optional(
        Type.Number({ description: "超时毫秒，默认 120000（2 分钟）" }),
      ),
    }),
    execute: async (_id, params) => {
      const title =
        typeof (params as { title?: string }).title === "string"
          ? (params as { title: string }).title.trim()
          : "请选择";
      const options = normalizeOptions((params as { options?: unknown }).options);
      if (options.length < 2) {
        throw new Error("options must contain at least 2 non-empty strings");
      }
      const timeoutRaw = (params as { timeoutMs?: number }).timeoutMs;
      const timeoutMs =
        typeof timeoutRaw === "number" && Number.isFinite(timeoutRaw)
          ? timeoutRaw
          : DEFAULT_CHOICE_TIMEOUT_MS;

      const { requestId, promise } = waitForUserChoice({
        visitorId,
        timeoutMs,
        signal,
      });
      const expiresAt = new Date(Date.now() + timeoutMs).toISOString();
      onEvent({
        type: "choice_card",
        requestId,
        title: title || "请选择",
        options,
        expiresAt,
      });

      const result = await promise;
      if (result.status === "timeout") {
        onEvent({ type: "choice_expired", requestId });
      }
      return asToolResult(result);
    },
  };
}
