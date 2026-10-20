import type { SkillLoader } from "../Skill/skill-loader.js";
import type { AgentStreamEvent } from "./stream-events.js";

/** 本轮请求里前端带来的帮写 buffer（不在磁盘） */
export type CodingDocContext = {
  documentId: string | null;
  workingMarkdown: string;
  baseMarkdown: string;
};

/** DeepSeek Search/Fetch：仅 kind=deepseek 时注入 */
export type DeepSeekWebCreds = {
  apiKey: string;
  baseUrl?: string;
};

/** 装配 / 单个 tool 共用的依赖，一律用 `{}` 传递 */
export type ToolDeps = {
  visitorId: string;
  /** 交互副作用：choice_card / skill_form_card / open_coding 等 */
  onEvent: (event: AgentStreamEvent) => void;
  signal?: AbortSignal;
  /** 手册；缺省则 template 的 manual 集合为空 */
  skills?: SkillLoader | null;
  /** coding 读写 buffer */
  coding?: CodingDocContext;
  /** 有值时注册 web_search / web_fetch */
  deepseekWeb?: DeepSeekWebCreds;
};

export function asToolResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}
