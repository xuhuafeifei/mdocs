/**
 * MCP 服务器配置：落盘 dataDir/mcp-servers.json，全实例共用。
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getConfig } from "../config/index.js";

export type McpServerTransport = "http";

export type McpServerConfig = {
  id: string;
  name: string;
  enabled: boolean;
  transport: McpServerTransport;
  url: string;
  headers?: Record<string, string>;
};

type McpServersFile = {
  servers?: McpServerConfig[];
};

function storePath(): string {
  return path.join(getConfig().dataDir, "mcp-servers.json");
}

function readFile(): McpServersFile {
  try {
    const raw = fs.readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw) as McpServersFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFile(payload: McpServersFile): void {
  const dir = getConfig().dataDir;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath(), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeHeaders(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim();
    if (!key) continue;
    if (typeof v !== "string") continue;
    out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 校验并归一化一条配置；非法抛 Error */
export function normalizeMcpServerInput(
  raw: unknown,
  { requireId = false }: { requireId?: boolean } = {},
): McpServerConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("server must be an object");
  }
  const r = raw as Record<string, unknown>;
  const id =
    typeof r.id === "string" && r.id.trim()
      ? r.id.trim()
      : requireId
        ? ""
        : randomUUID();
  if (requireId && !id) throw new Error("id is required");
  const name = String(r.name ?? "").trim();
  if (!name) throw new Error("name is required");
  const url = String(r.url ?? "").trim();
  if (!url) throw new Error("url is required");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("url is invalid");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("url must be http or https");
  }
  const transport = r.transport === "http" || r.transport == null ? "http" : null;
  if (!transport) throw new Error('transport must be "http"');
  const enabled = r.enabled !== false;
  const headers = normalizeHeaders(r.headers);
  return {
    id: id || randomUUID(),
    name,
    enabled,
    transport: "http",
    url,
    ...(headers ? { headers } : {}),
  };
}

export function listMcpServers(): McpServerConfig[] {
  const file = readFile();
  const list = Array.isArray(file.servers) ? file.servers : [];
  return list
    .map((s) => {
      try {
        return normalizeMcpServerInput(s, { requireId: true });
      } catch {
        return null;
      }
    })
    .filter((s): s is McpServerConfig => Boolean(s));
}

export function getMcpServerById(id: string): McpServerConfig | null {
  const want = id.trim();
  if (!want) return null;
  return listMcpServers().find((s) => s.id === want) ?? null;
}

export function listEnabledHttpMcpServers(): McpServerConfig[] {
  return listMcpServers().filter((s) => s.enabled && s.transport === "http");
}

/** 整表替换；返回归一化后的列表 */
export function replaceMcpServers(rawServers: unknown): McpServerConfig[] {
  if (!Array.isArray(rawServers)) {
    throw new Error("servers must be an array");
  }
  const seen = new Set<string>();
  const servers: McpServerConfig[] = [];
  for (const item of rawServers) {
    const s = normalizeMcpServerInput(item);
    if (seen.has(s.id)) throw new Error(`duplicate server id: ${s.id}`);
    seen.add(s.id);
    servers.push(s);
  }
  writeFile({ servers });
  return servers;
}

/** 插件安装写入 MCP 列表时用的本机 Memorix 地址。设置页不暴露这条模板。 */
export const MEMORIX_MCP_TEMPLATE: Omit<McpServerConfig, "id"> = {
  name: "Memorix",
  enabled: true,
  transport: "http",
  url: "http://127.0.0.1:3211/mcp",
};

/** 插件安装用：按 id upsert 一条；返回最新全表 */
export function upsertMcpServer(raw: unknown): McpServerConfig[] {
  const next = normalizeMcpServerInput(raw, { requireId: true });
  const list = listMcpServers();
  const idx = list.findIndex((s) => s.id === next.id);
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  writeFile({ servers: list });
  return list;
}

/** 按 id 删除；不存在则 noop。返回最新全表 */
export function removeMcpServerById(id: string): McpServerConfig[] {
  const want = id.trim();
  const list = listMcpServers().filter((s) => s.id !== want);
  writeFile({ servers: list });
  return list;
}
