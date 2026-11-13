import {
  getMcpServerById,
  listMcpServers,
  replaceMcpServers,
} from "../mcp-servers-store.js";
import { McpError } from "../mcp-error.js";

export function listMcpServersPayload() {
  return { servers: listMcpServers() };
}

export function replaceMcpServersPayload(servers: unknown) {
  try {
    return { servers: replaceMcpServers(servers) };
  } catch (err) {
    throw new McpError(
      "BAD_REQUEST",
      err instanceof Error ? err.message : String(err),
      400,
    );
  }
}

export async function testMcpServerById(id: string) {
  const server = getMcpServerById(id.trim());
  if (!server) {
    throw new McpError("NOT_FOUND", "mcp server not found", 404);
  }

  // 懒加载：缺 @modelcontextprotocol/sdk 时不应拖垮整个 mdocs 启动
  let testMcpServer: typeof import("../mcp-client.js").testMcpServer;
  try {
    ({ testMcpServer } = await import("../mcp-client.js"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "MCP client unavailable";
    throw new McpError("MCP_SDK_MISSING", message, 503);
  }

  const result = await testMcpServer(server);
  if (!result.ok) {
    throw new McpError("MCP_UNREACHABLE", result.error, 502);
  }
  return { ok: true as const, tools: result.tools };
}
