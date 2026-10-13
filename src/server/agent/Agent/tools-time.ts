import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { asToolResult } from "./tool-deps.js";

function formatLocal(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    local: `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} ${get("weekday")}`,
  };
}

/** 告诉 Agent 服务器当前时刻；无参数 */
export function getNowTool(): AgentTool {
  return {
    name: "get_now",
    label: "获取当前时间",
    description:
      "返回服务器当前时刻：ISO（UTC）、本地可读时间、时区、星期、Unix 毫秒。用户问现在几点、今天几号、星期几或任何日期相关问题时必须调用，禁止臆造时间。",
    parameters: Type.Object({}),
    execute: async () => {
      const now = new Date();
      const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const { weekday, local } = formatLocal(now, timeZone);
      return asToolResult({
        iso: now.toISOString(),
        epochMs: now.getTime(),
        timeZone,
        weekday,
        local,
      });
    },
  };
}
