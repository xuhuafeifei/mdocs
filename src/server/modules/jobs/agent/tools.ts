/**
 * Job Agent 工具集：白名单组装，后续加工具只改这里。
 */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ToolDeps } from "../../../agent/Agent/tool-deps";
import { deepseekWebTools } from "../../../agent/Agent/tools-web";
import { getNowTool } from "../../../agent/Agent/tools-time";
import { jobAppendDataTool } from "./tools-job-data";
import type { JobAgentContext } from "./types";

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
