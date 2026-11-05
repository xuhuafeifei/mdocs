/**
 * Job Agent 工具集：白名单组装，后续加工具只改这里。
 */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ToolDeps } from "../../agent/Agent/tool-deps.js";
import { deepseekWebTools } from "../../agent/Agent/tools-web.js";
import { getNowTool } from "../../agent/Agent/tools-time.js";
import { jobAppendDataTool } from "./tools-job-data.js";
import type { JobAgentContext } from "./types.js";

export function createJobAgentTools(
  ctx: JobAgentContext,
  toolDeps: ToolDeps,
): AgentTool[] {
  return [
    getNowTool(),
    ...deepseekWebTools(toolDeps),
    jobAppendDataTool(ctx),
  ];
}
