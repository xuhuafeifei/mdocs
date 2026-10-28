/**
 * 内置插件目录。
 * Engram：下载 GitHub release 二进制，stdio MCP（`engram mcp`）。
 * Memorix：npm 全局安装 + HTTP MCP（可选样板）。
 */
import {
  ENGRAM_MCP_TEMPLATE,
  MEMORIX_MCP_TEMPLATE,
  type McpServerConfig,
} from "../mcp/mcp-servers-store.js";

export type PluginKind = "mcp";

export type PluginCatalogEntry = {
  id: string;
  name: string;
  description: string;
  kind: PluginKind;
  /** 写入 MCP 时使用的稳定 id */
  mcpServerId: string;
  mcpTemplate: Omit<McpServerConfig, "id">;
};

export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
  {
    id: "engram",
    name: "Engram",
    description:
      "本机记忆（Go 单二进制 + SQLite）。安装会从 GitHub Releases 下载，并以 stdio MCP（engram mcp）接入。不依赖 git 仓库。",
    kind: "mcp",
    mcpServerId: "plugin-engram",
    mcpTemplate: { ...ENGRAM_MCP_TEMPLATE },
  },
  {
    id: "memorix",
    name: "Memorix",
    description:
      "本机记忆服务。安装会执行 npm install -g memorix，并启动 HTTP（http://127.0.0.1:3211/mcp）。需要 Node.js >= 22.18。",
    kind: "mcp",
    mcpServerId: "plugin-memorix",
    mcpTemplate: { ...MEMORIX_MCP_TEMPLATE },
  },
];

export function getCatalogEntry(id: string): PluginCatalogEntry | null {
  const want = id.trim();
  return PLUGIN_CATALOG.find((p) => p.id === want) ?? null;
}
