/**
 * MCP Client：HTTP（Streamable）或 stdio，listTools / callTool，桥成 pi-agent AgentTool。
 */
import fs from "node:fs";
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { useLogger } from "../logger/logger.js";
import {
  buildEngramMcpEnv,
  ensureEngramProject,
  engramBinaryPath,
  engramProjectForVisitor,
  engramWorkspaceRoot,
} from "../plugins/engram-runtime.js";
import {
  ensureMemorixGitWorkspace,
  memorixProjectRoot,
} from "../plugins/memorix-runtime.js";
import {
  listEnabledMcpServers,
  type McpServerConfig,
} from "./mcp-servers-store.js";

const log = useLogger("mcp-client");

/** Engram：宿主代调后不对 Agent 暴露，避免模型改绑 session/project */
const ENGRAM_HIDE_FROM_AGENT = new Set(["mem_session_start"]);

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

function serverLabel(server: McpServerConfig): string {
  if (server.transport === "stdio") {
    const args = (server.args ?? []).join(" ");
    return `${server.command ?? ""}${args ? ` ${args}` : ""}`.trim() || server.name;
  }
  return server.url ?? server.name;
}

async function openClient(server: McpServerConfig): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const client = new Client({
    name: "mdocs",
    version: "3.0.10",
  });

  if (server.transport === "stdio") {
    const command = server.command?.trim();
    if (!command) throw new Error("stdio MCP server missing command");
    const transport = new StdioClientTransport({
      command,
      args: server.args ?? [],
      env: {
        ...getDefaultEnvironment(),
        ...(server.env ?? {}),
      },
      cwd: server.cwd,
      stderr: "pipe",
    });
    await client.connect(transport);
    return {
      client,
      close: async () => {
        try {
          await client.close();
        } catch (err) {
          log.warn(
            `close ${server.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    };
  }

  if (!server.url) throw new Error("http MCP server missing url");
  const headers = server.headers ? { ...server.headers } : undefined;
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
        log.warn(
          `close ${server.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
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
  const blob = `${server.id} ${server.name} ${server.url ?? ""} ${server.command ?? ""}`.toLowerCase();
  if (blob.includes("memorix")) return true;
  return toolNames.some((n) => n.startsWith("memorix_"));
}

function looksLikeEngram(server: McpServerConfig, _toolNames: string[]): boolean {
  const blob = `${server.id} ${server.name} ${server.command ?? ""}`.toLowerCase();
  return blob.includes("engram");
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

/**
 * Engram：仅有 ENGRAM_PROJECT 不够，库里未登记会话时 mem_stats/search 会 unknown_project。
 * 每轮由宿主代调 mem_session_start（不对 Agent 暴露该 tool）。
 */
async function bindEngramSession(
  client: Client,
  toolNames: string[],
  visitorId: string,
): Promise<void> {
  if (!toolNames.includes("mem_session_start")) return;
  const project = engramProjectForVisitor(visitorId);
  let directory = engramWorkspaceRoot();
  try {
    directory = await ensureEngramProject(undefined, project);
  } catch (err) {
    log.warn(
      `ensure engram project: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  try {
    const result = await client.callTool({
      name: "mem_session_start",
      arguments: {
        id: `mdocs-${visitorId.trim() || process.pid}`,
        directory,
      },
    });
    if ((result as { isError?: boolean }).isError) {
      const text = contentToText((result as { content?: unknown }).content);
      log.warn(`mem_session_start: ${text.slice(0, 300)}`);
    } else {
      log.info(`engram session bound project=${project} dir=${directory}`);
    }
  } catch (err) {
    log.warn(
      `mem_session_start failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function bindMemorySessions(
  server: McpServerConfig,
  client: Client,
  toolNames: string[],
  visitorId: string,
): Promise<void> {
  if (looksLikeMemorix(server, toolNames)) {
    await bindMemorixHttpSession(client, toolNames);
  }
  if (looksLikeEngram(server, toolNames)) {
    await bindEngramSession(client, toolNames, visitorId);
  }
}

/** 按访客改写 Engram stdio 的 project / env（共享二进制，数据按 project 分桶）。 */
function resolveServerForVisitor(
  server: McpServerConfig,
  visitorId: string,
): McpServerConfig {
  if (!looksLikeEngram(server, [])) return server;
  const project = engramProjectForVisitor(visitorId);
  const bin = engramBinaryPath();
  const command =
    server.command && fsExists(server.command) ? server.command : bin;
  const args = ["mcp", `--project=${project}`];
  return {
    ...server,
    command,
    args,
    cwd: server.cwd || engramWorkspaceRoot(),
    env: {
      ...buildEngramMcpEnv(project),
      ...(server.env ?? {}),
      ENGRAM_PROJECT: project,
      ENGRAM_DATA_DIR: buildEngramMcpEnv(project).ENGRAM_DATA_DIR,
    },
  };
}

function fsExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/** 测试连接：listTools 摘要 */
export async function testMcpServer(
  server: McpServerConfig,
): Promise<McpTestResult> {
  try {
    const { client, close } = await openClient(server);
    try {
      const listed = await client.listTools();
      const tools = (listed.tools ?? []).map((t) => ({
        name: t.name,
        ...(t.description ? { description: t.description } : {}),
      }));
      const names = tools.map((t) => t.name);
      await bindMemorySessions(server, client, names, "");
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
 * 为当前 Agent 轮次加载所有已启用 MCP 工具（HTTP + stdio）。
 * Engram：按 visitorId 注入 project，并隐藏 mem_session_start。
 * 单 server 失败跳过；调用方必须在 finally 里 close。
 */
export async function loadMcpAgentTools(
  visitorId = "",
): Promise<McpAgentToolsBundle> {
  const servers = listEnabledMcpServers();
  if (servers.length === 0) {
    return { tools: [], close: async () => {} };
  }

  const closers: Array<() => Promise<void>> = [];
  const tools: AgentTool[] = [];
  const vid = visitorId.trim();

  for (const raw of servers) {
    const server = resolveServerForVisitor(raw, vid);
    try {
      const { client, close } = await openClient(server);
      closers.push(close);
      const listed = await client.listTools();
      const toolNames = (listed.tools ?? []).map((t) => t.name);
      await bindMemorySessions(server, client, toolNames, vid);
      const prefix = toolPrefix(server);
      const hide =
        looksLikeEngram(server, toolNames) ? ENGRAM_HIDE_FROM_AGENT : null;
      for (const mcpTool of listed.tools ?? []) {
        const originalName = mcpTool.name;
        if (hide?.has(originalName)) continue;
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
        `loaded ${listed.tools?.length ?? 0} tools from ${server.name} (${serverLabel(server)})`,
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
