/**
 * HTTP MCP Client：连接远程 server，listTools / callTool，桥成 pi-agent AgentTool。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { useLogger } from "../logger/logger.js";
import {
  ensureMemorixGitWorkspace,
  memorixProjectRoot,
} from "../plugins/memorix-runtime.js";
import {
  listEnabledHttpMcpServers,
  type McpServerConfig,
} from "./mcp-servers-store.js";

const log = useLogger("mcp-client");

export type McpToolSummary = {
  name: string;
  description?: string;
};

export type McpTestResult = {
  ok: true;
  tools: McpToolSummary[];
} | {
  ok: false;
  error: string;
};

export type McpAgentToolsBundle = {
  tools: AgentTool[];
  close: () => Promise<void>;
};

function slugify(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return s || "server";
}

function toolPrefix(server: McpServerConfig): string {
  return `mcp__${slugify(server.name || server.id)}__`;
}

function asAgentToolParameters(inputSchema: unknown) {
  if (inputSchema && typeof inputSchema === "object") {
    return Type.Unsafe(inputSchema);
  }
  return Type.Object({}, { additionalProperties: true });
}

async function openHttpClient(server: McpServerConfig): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const client = new Client({
    name: "mdocs",
    version: "3.0.4",
  });
  const headers = server.headers
    ? { ...server.headers }
    : undefined;
  const transport = new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: headers ? { headers } : undefined,
  });
  await client.connect(transport);
  return {
    client,
    close: async () => {
      try {
        await client.close();
      } catch (err) {
        log.warn(`close ${server.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function contentToText(content: unknown): string {
  if (!Array.isArray(content)) {
    return typeof content === "string" ? content : JSON.stringify(content ?? null);
  }
  const parts: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: string; text?: string };
    if (row.type === "text" && typeof row.text === "string") {
      parts.push(row.text);
      continue;
    }
    parts.push(JSON.stringify(item));
  }
  return parts.join("\n") || "";
}

function looksLikeMemorix(server: McpServerConfig, toolNames: string[]): boolean {
  const blob = `${server.id} ${server.name} ${server.url}`.toLowerCase();
  if (blob.includes("memorix")) return true;
  return toolNames.some((n) => n.startsWith("memorix_"));
}

/**
 * HTTP Memorix 必须显式绑 projectRoot（且路径须含 .git），否则 store/search 会报
 * "No git project could be resolved"。
 */
async function bindMemorixHttpSession(
  client: Client,
  toolNames: string[],
): Promise<void> {
  if (!toolNames.includes("memorix_session_start")) return;
  let projectRoot = memorixProjectRoot();
  try {
    projectRoot = await ensureMemorixGitWorkspace();
  } catch (err) {
    log.warn(
      `ensure memorix workspace: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  try {
    const result = await client.callTool({
      name: "memorix_session_start",
      arguments: {
        agent: "mdocs",
        agentType: "mdocs",
        projectRoot,
      },
    });
    if ((result as { isError?: boolean }).isError) {
      const text = contentToText((result as { content?: unknown }).content);
      log.warn(`memorix_session_start: ${text.slice(0, 300)}`);
    } else {
      log.info(`memorix session bound to ${projectRoot}`);
    }
  } catch (err) {
    log.warn(
      `memorix_session_start failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** 测试连接：listTools 摘要 */
export async function testMcpServer(
  server: McpServerConfig,
): Promise<McpTestResult> {
  try {
    const { client, close } = await openHttpClient(server);
    try {
      const listed = await client.listTools();
      const tools = (listed.tools ?? []).map((t) => ({
        name: t.name,
        ...(t.description ? { description: t.description } : {}),
      }));
      const names = tools.map((t) => t.name);
      if (looksLikeMemorix(server, names)) {
        await bindMemorixHttpSession(client, names);
      }
      return { ok: true, tools };
    } finally {
      await close();
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 为当前 Agent 轮次加载所有已启用 HTTP MCP 工具。
 * 单 server 失败跳过；调用方必须在 finally 里 close。
 */
export async function loadMcpAgentTools(): Promise<McpAgentToolsBundle> {
  const servers = listEnabledHttpMcpServers();
  if (servers.length === 0) {
    return { tools: [], close: async () => {} };
  }

  const closers: Array<() => Promise<void>> = [];
  const tools: AgentTool[] = [];

  for (const server of servers) {
    try {
      const { client, close } = await openHttpClient(server);
      closers.push(close);
      const listed = await client.listTools();
      const toolNames = (listed.tools ?? []).map((t) => t.name);
      if (looksLikeMemorix(server, toolNames)) {
        await bindMemorixHttpSession(client, toolNames);
      }
      const prefix = toolPrefix(server);
      for (const mcpTool of listed.tools ?? []) {
        const originalName = mcpTool.name;
        const name = `${prefix}${originalName}`;
        const description =
          (mcpTool.description?.trim() || `MCP tool ${originalName}`) +
          `（来自 MCP 服务器「${server.name}」）`;
        tools.push({
          name,
          label: `MCP · ${server.name}/${originalName}`,
          description,
          parameters: asAgentToolParameters(mcpTool.inputSchema) as never,
          execute: async (_id, params) => {
            const result = await client.callTool({
              name: originalName,
              arguments:
                params && typeof params === "object"
                  ? (params as Record<string, unknown>)
                  : {},
            });
            const text = contentToText(
              (result as { content?: unknown }).content,
            );
            const isError = Boolean((result as { isError?: boolean }).isError);
            if (isError) {
              throw new Error(text || `MCP tool ${originalName} failed`);
            }
            return {
              content: [{ type: "text" as const, text: text || "(empty)" }],
              details: result,
            };
          },
        });
      }
      log.info(
        `loaded ${listed.tools?.length ?? 0} tools from ${server.name} (${server.url})`,
      );
    } catch (err) {
      log.warn(
        `skip MCP server ${server.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    tools,
    close: async () => {
      for (const c of closers.reverse()) {
        await c();
      }
    },
  };
}
