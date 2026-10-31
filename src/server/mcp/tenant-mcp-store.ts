/**
 * 租户 MCP：tenant/{vid}/mcp/<plugin-name>.json（每插件一文件）。
 */
import fs from "node:fs";
import {
  normalizePluginName,
  visitorMcpDir,
  visitorMcpFile,
} from "../plugins/plugin-paths.js";
import {
  normalizeMcpServerInput,
  type McpServerConfig,
} from "./mcp-servers-store.js";

function readTenantFile(visitorId: string, pluginId: string): McpServerConfig | null {
  const p = visitorMcpFile(visitorId, pluginId);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
    return normalizeMcpServerInput(raw, { requireId: true });
  } catch {
    return null;
  }
}

function writeTenantFile(visitorId: string, server: McpServerConfig): void {
  const dir = visitorMcpDir(visitorId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const name = normalizePluginName(server.id);
  const file = visitorMcpFile(visitorId, name);
  const payload: McpServerConfig = { ...server, id: name };
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function listVisitorMcpServers(visitorId: string): McpServerConfig[] {
  const vid = visitorId.trim();
  if (!vid) return [];
  const dir = visitorMcpDir(vid);
  if (!fs.existsSync(dir)) return [];
  const out: McpServerConfig[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const s = readTenantFile(vid, name.slice(0, -".json".length));
    if (s) out.push(s);
  }
  return out;
}

export function listEnabledVisitorMcpServers(visitorId: string): McpServerConfig[] {
  return listVisitorMcpServers(visitorId).filter((s) => s.enabled);
}

export function getVisitorMcpServer(
  visitorId: string,
  pluginId: string,
): McpServerConfig | null {
  return readTenantFile(visitorId.trim(), pluginId);
}

/** 写入 tenant 文件；id 规范为 plugin-name */
export function upsertVisitorMcpServer(
  visitorId: string,
  raw: unknown,
): McpServerConfig {
  const vid = visitorId.trim();
  if (!vid) throw new Error("visitor required");
  const next = normalizeMcpServerInput(raw, { requireId: true });
  const id = normalizePluginName(next.id.replace(/^plugin-/, ""));
  const server: McpServerConfig = { ...next, id };
  writeTenantFile(vid, server);
  return server;
}

export function removeVisitorMcpServer(
  visitorId: string,
  pluginId: string,
): void {
  const file = visitorMcpFile(visitorId.trim(), pluginId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function upsertMcpServerForVisitor(
  visitorId: string | null | undefined,
  raw: unknown,
): McpServerConfig {
  if (!visitorId?.trim()) throw new Error("visitor required for MCP upsert");
  return upsertVisitorMcpServer(visitorId, raw);
}
