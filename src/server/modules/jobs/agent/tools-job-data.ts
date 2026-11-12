import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { asToolResult } from "../../../agent/Agent/tool-deps";
import type { JobAgentContext } from "./types";

/** 向当前 job_running 追加表数据点（job_running_id 由运行时绑定，不可伪造）。 */
export function jobAppendDataTool(ctx: JobAgentContext): AgentTool {
  return {
    name: "job_append_data",
    label: "写入 Job 产出",
    description:
      "把采集到的数据点追加到当前 Job 运行结果表。" +
      `横轴含义：${ctx.tableSchema.x}；纵轴含义：${ctx.tableSchema.y}。` +
      "y 必须是有限数字。可多次调用。",
    parameters: Type.Object({
      points: Type.Array(
        Type.Object({
          x: Type.String({ description: `横轴值（${ctx.tableSchema.x}）` }),
          y: Type.Number({ description: `纵轴数值（${ctx.tableSchema.y}）` }),
        }),
        { minItems: 1 },
      ),
    }),
    execute: async (_id, params) => {
      const raw = (params as { points?: unknown }).points;
      if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error("points is required");
      }
      const points: Array<{ x: string; y: number }> = [];
      for (const row of raw) {
        const r = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
        if (!r) throw new Error("invalid point");
        const x = String(r.x ?? "").trim();
        const y = Number(r.y);
        if (!x) throw new Error("point.x is required");
        if (!Number.isFinite(y)) throw new Error("point.y must be a finite number");
        points.push({ x, y });
      }
      await ctx.appendData(points);
      return asToolResult({
        jobId: ctx.jobId,
        jobRunningId: ctx.jobRunningId,
        appended: points.length,
      });
    },
  };
}
