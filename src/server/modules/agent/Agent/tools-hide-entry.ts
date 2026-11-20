import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { asToolResult, type ToolDeps } from "./tool-deps";

/** 隐藏本机智能助手入口（前端写 localStorage；服务端不存偏好） */
export function hideAgentEntryTool({ onEvent }: ToolDeps): AgentTool {
  return {
    name: "hide_agent_entry",
    label: "隐藏 AI 入口",
    description:
      "隐藏本机右下角智能助手入口并关闭当前面板。偏好写入浏览器 localStorage。仅在用户明确要求隐藏/关掉助手入口时调用；禁止擅自调用。恢复须用户到「设置 → 通用」。",
    parameters: Type.Object({}),
    execute: async () => {
      onEvent({ type: "agent_entry_hidden" });
      return asToolResult({
        status: "hidden",
        message: "已隐藏 AI 入口；可在设置 → 通用恢复",
      });
    },
  };
}
