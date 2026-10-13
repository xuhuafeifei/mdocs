import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  AGENT_THINKING_LEVELS,
  setDefaultThinkingLevel,
} from "../Config/config.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

/** 只改当前默认模型配置的思考档位 */
export function setThinkingLevelTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "set_thinking_level",
    label: "设置思考强度",
    description:
      "修改当前默认 AI 配置的思考档位：off（关）/ low / high / max。仅在用户明确要求调思考强度或开关思考时调用；禁止擅自调高。下一轮对话生效。",
    parameters: Type.Object({
      level: Type.Unsafe<"off" | "low" | "high" | "max">({
        type: "string",
        enum: [...AGENT_THINKING_LEVELS],
        description: "off | low | high | max",
      }),
    }),
    execute: async (_id, params) => {
      const level = String((params as { level?: string }).level ?? "").trim();
      if (!(AGENT_THINKING_LEVELS as readonly string[]).includes(level)) {
        throw new Error(`invalid level: ${level}; use off|low|high|max`);
      }
      const cfg = setDefaultThinkingLevel(visitorId, level);
      return asToolResult({
        status: "updated",
        thinkingLevel: cfg.thinkingLevel,
        configId: cfg.id,
        configName: cfg.name,
        message: `已将默认配置「${cfg.name}」思考档位设为 ${cfg.thinkingLevel}（下一轮生效）`,
      });
    },
  };
}
