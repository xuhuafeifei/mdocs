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
  pluginCliManageTools,
  pluginPipelineTools,
  userSkillManageTools,
  utilityTools,
} from "./tools-template.js";

export type { ToolDeps };

/**
 * normal → manual + utility + account + choice + overwrite + user_skills
 * coding → manual + utility + account + choice + coding_write + user_skills
 * plugin-pipeline → choice + pipeline（探测 + submit）+ plugin CLI / query_skill
 */
export function createToolsForMode(
  mode: AgentMode,
  deps: ToolDeps,
): AgentTool[] {
  if (mode === "plugin-pipeline") {
    if (!deps.pipeline) throw new Error("plugin-pipeline mode requires pipeline ctx");
    return [...choiceTools(deps), ...pluginPipelineTools(deps)];
  }
  if (mode === "coding") {
    if (!deps.coding) throw new Error("coding mode requires coding ctx");
    return [
      ...manualTools(deps),
      ...utilityTools(deps),
      ...accountTools(deps),
      ...choiceTools(deps),
      ...codingWriteTools(deps),
      ...userSkillManageTools(deps),
      ...pluginCliManageTools(deps),
    ];
  }

  return [
    ...manualTools(deps),
    ...utilityTools(deps),
    ...accountTools(deps),
    ...choiceTools(deps),
    ...overwriteTools(deps),
    ...userSkillManageTools(deps),
    ...pluginCliManageTools(deps),
  ];
}
