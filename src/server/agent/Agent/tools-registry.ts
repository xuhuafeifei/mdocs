/**
 * 按 mode 取 template 组合；对外只暴露 createToolsForMode。
 */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { AgentMode } from "./system-prompt.js";
import type { ToolDeps } from "./tool-deps.js";
import {
  accountTools,
  choiceTools,
  codingWriteTools,
  manualTools,
  overwriteTools,
} from "./tools-template.js";

export type { ToolDeps };

/**
 * normal → manual + account + choice + overwrite  
 * coding → manual + account + choice + coding_write
 */
export function createToolsForMode(
  mode: AgentMode,
  deps: ToolDeps,
): AgentTool[] {
  if (mode === "coding") {
    if (!deps.coding) throw new Error("coding mode requires coding ctx");
    return [
      ...manualTools(deps),
      ...accountTools(deps),
      ...choiceTools(deps),
      ...codingWriteTools(deps),
    ];
  }

  return [
    ...manualTools(deps),
    ...accountTools(deps),
    ...choiceTools(deps),
    ...overwriteTools(deps),
  ];
}
