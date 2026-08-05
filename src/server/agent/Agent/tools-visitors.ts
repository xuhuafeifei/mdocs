import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { getDb } from "../../db/connection.js";
import { listActiveVisitorsDirectory } from "../../db/repositories/visitor.repo.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

export function listVisitorsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "list_visitors",
    label: "列出活跃访客",
    description:
      "列出系统中全部活跃访客（潜在可邀请成员），返回 visitorId / visitorName；当前用户会标 isMe=true。用于回答「有哪些人可以邀请进域/文档」。",
    parameters: Type.Object({}),
    execute: async () => {
      const rows = listActiveVisitorsDirectory(getDb());
      const visitors = rows.map((r) => ({
        visitorId: r.visitor_id,
        visitorName: r.visitor_name,
        isMe: r.visitor_id === visitorId,
      }));
      return asToolResult({ total: visitors.length, visitors });
    },
  };
}
