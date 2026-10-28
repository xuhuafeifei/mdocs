/**
 * 内置插件目录。Memorix 安装会在本机 npm 安装并启动 HTTP 服务，
 * 再把通用 MCP 列表里的对应项指到该服务。
 */
import { MEMORIX_MCP_TEMPLATE } from "../mcp/mcp-servers-store.js";

export type PluginKind = "mcp";

export type PluginCatalogEntry = {
  id: string;
  name: string;
  description: string;
  kind: PluginKind;
  /** 写入 MCP 时使用的稳定 id */
  mcpServerId: string;
  mcpTemplate: typeof MEMORIX_MCP_TEMPLATE;
};

export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
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
