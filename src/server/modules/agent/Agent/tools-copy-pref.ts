import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { asToolResult, type ToolDeps } from "./tool-deps";

/** 设置本机「复制全文保留空行」偏好（前端写 localStorage；服务端不存） */
export function setCopyPreserveBlankLinesTool({ onEvent }: ToolDeps): AgentTool {
  return {
    name: "set_copy_preserve_blank_lines",
    label: "复制全文空行偏好",
    description:
      "设置本机「复制全文」是否保留文档里的空白行（空段落）。" +
      "preserve=true 保留空行；false 则经 Markdown 美化时压掉连续空行。" +
      "偏好写入浏览器 localStorage。仅在用户明确要求改这项设置时调用。",
    parameters: Type.Object({
      preserve: Type.Boolean({
        description: "true=复制时保留空行；false=允许压掉空行",
      }),
    }),
    execute: async (_id, params) => {
      const p = params as { preserve?: boolean };
      const preserve = Boolean(p.preserve);
      onEvent({ type: "copy_preserve_blank_lines", preserve });
      return asToolResult({
        status: "ok",
        preserve,
        message: preserve
          ? "已开启：复制全文保留空行"
          : "已关闭：复制全文可压掉空行",
      });
    },
  };
}
