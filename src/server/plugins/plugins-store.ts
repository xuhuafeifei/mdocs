/**
 * 插件安装态：{dataDir}/plugins.json
 */
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config/index.js";
import {
  getCatalogEntry,
  PLUGIN_CATALOG,
  type PluginCatalogEntry,
} from "./plugin-catalog.js";
import {
  getMcpServerById,
  removeMcpServerById,
  upsertMcpServer,
  type McpServerConfig,
} from "../mcp/mcp-servers-store.js";
import {
  installMemorixRuntime,
  MEMORIX_HTTP_MCP_URL,
  uninstallMemorixRuntime,
  type MemorixInstallPhase,
  type MemorixOutput,
} from "./memorix-runtime.js";

export type PluginInstallPhase = MemorixInstallPhase | "saving";

export type InstalledPluginRecord = {
  id: string;
  installedAt: string;
  mcpServerId?: string;
};

type PluginsFile = {
  installed?: InstalledPluginRecord[];
};

export type PluginListItem = PluginCatalogEntry & {
  installed: boolean;
  installedAt: string | null;
  mcpServer: McpServerConfig | null;
};

function storePath(): string {
  return path.join(getConfig().dataDir, "plugins.json");
}

function readFile(): PluginsFile {
  try {
    const raw = fs.readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw) as PluginsFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFile(payload: PluginsFile): void {
  const dir = getConfig().dataDir;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath(), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function listInstalled(): InstalledPluginRecord[] {
  const file = readFile();
  const list = Array.isArray(file.installed) ? file.installed : [];
  return list.filter((r) => r && typeof r.id === "string" && r.id.trim());
}

export function listPlugins(): PluginListItem[] {
  const installed = new Map(listInstalled().map((r) => [r.id, r]));
  return PLUGIN_CATALOG.map((entry) => {
    const rec = installed.get(entry.id);
    const mcpId = rec?.mcpServerId ?? entry.mcpServerId;
    return {
      ...entry,
      installed: Boolean(rec),
      installedAt: rec?.installedAt ?? null,
      mcpServer: getMcpServerById(mcpId),
    };
  });
}

export type InstallPluginOptions = {
  headers?: Record<string, string>;
};

export async function installPlugin(
  pluginId: string,
  opts: InstallPluginOptions = {},
  hooks?: {
    onPhase?: (phase: PluginInstallPhase) => void;
    onOutput?: MemorixOutput;
  },
): Promise<PluginListItem> {
  const entry = getCatalogEntry(pluginId);
  if (!entry) throw new Error("plugin not found");
  if (entry.kind !== "mcp") throw new Error("unsupported plugin kind");

  if (entry.id === "memorix") {
    await installMemorixRuntime(
      (phase) => hooks?.onPhase?.(phase),
      hooks?.onOutput,
    );
  }
  hooks?.onPhase?.("saving");

  const url = entry.id === "memorix" ? MEMORIX_HTTP_MCP_URL : entry.mcpTemplate.url;
  upsertMcpServer({
    id: entry.mcpServerId,
    name: entry.mcpTemplate.name,
    enabled: true,
    transport: "http",
    url,
    ...(opts.headers ? { headers: opts.headers } : entry.mcpTemplate.headers
      ? { headers: entry.mcpTemplate.headers }
      : {}),
  });

  const installedAt = new Date().toISOString();
  const others = listInstalled().filter((r) => r.id !== entry.id);
  others.push({
    id: entry.id,
    installedAt,
    mcpServerId: entry.mcpServerId,
  });
  writeFile({ installed: others });

  const listed = listPlugins().find((p) => p.id === entry.id);
  if (!listed) throw new Error("install failed");
  return listed;
}

export async function uninstallPlugin(pluginId: string): Promise<PluginListItem> {
  const entry = getCatalogEntry(pluginId);
  if (!entry) throw new Error("plugin not found");

  if (entry.id === "memorix") {
    await uninstallMemorixRuntime();
  }

  const rec = listInstalled().find((r) => r.id === entry.id);
  const mcpId = rec?.mcpServerId ?? entry.mcpServerId;
  removeMcpServerById(mcpId);

  writeFile({
    installed: listInstalled().filter((r) => r.id !== entry.id),
  });

  const listed = listPlugins().find((p) => p.id === entry.id);
  if (!listed) throw new Error("uninstall failed");
  return listed;
}
