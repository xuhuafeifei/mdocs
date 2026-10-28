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
  buildEngramMcpEnv,
  engramBinaryPath,
  engramWorkspaceRoot,
  installEngramRuntime,
  uninstallEngramRuntime,
  type EngramInstallPhase,
  type EngramOutput,
} from "./engram-runtime.js";
import {
  installMemorixRuntime,
  MEMORIX_HTTP_MCP_URL,
  uninstallMemorixRuntime,
  type MemorixInstallPhase,
  type MemorixOutput,
} from "./memorix-runtime.js";

export type PluginInstallPhase =
  | MemorixInstallPhase
  | EngramInstallPhase
  | "saving";

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

export type PluginInstallOutput = MemorixOutput | EngramOutput;

export async function installPlugin(
  pluginId: string,
  opts: InstallPluginOptions = {},
  hooks?: {
    onPhase?: (phase: PluginInstallPhase) => void;
    onOutput?: PluginInstallOutput;
  },
): Promise<PluginListItem> {
  const entry = getCatalogEntry(pluginId);
  if (!entry) throw new Error("plugin not found");
  if (entry.kind !== "mcp") throw new Error("unsupported plugin kind");

  if (entry.id === "engram") {
    await installEngramRuntime(
      (phase) => hooks?.onPhase?.(phase),
      hooks?.onOutput,
    );
  } else if (entry.id === "memorix") {
    await installMemorixRuntime(
      (phase) => hooks?.onPhase?.(phase),
      hooks?.onOutput,
    );
  }
  hooks?.onPhase?.("saving");

  if (entry.id === "engram") {
    upsertMcpServer({
      id: entry.mcpServerId,
      name: entry.mcpTemplate.name,
      enabled: true,
      transport: "stdio",
      command: engramBinaryPath(),
      args: ["mcp", "--project=mdocs"],
      cwd: engramWorkspaceRoot(),
      env: buildEngramMcpEnv(),
    });
  } else if (entry.id === "memorix") {
    upsertMcpServer({
      id: entry.mcpServerId,
      name: entry.mcpTemplate.name,
      enabled: true,
      transport: "http",
      url: MEMORIX_HTTP_MCP_URL,
      ...(opts.headers
        ? { headers: opts.headers }
        : entry.mcpTemplate.headers
          ? { headers: entry.mcpTemplate.headers }
          : {}),
    });
  } else {
    upsertMcpServer({
      id: entry.mcpServerId,
      name: entry.mcpTemplate.name,
      enabled: true,
      transport: entry.mcpTemplate.transport,
      ...(entry.mcpTemplate.url ? { url: entry.mcpTemplate.url } : {}),
      ...(entry.mcpTemplate.command
        ? { command: entry.mcpTemplate.command }
        : {}),
      ...(entry.mcpTemplate.args ? { args: entry.mcpTemplate.args } : {}),
      ...(opts.headers
        ? { headers: opts.headers }
        : entry.mcpTemplate.headers
          ? { headers: entry.mcpTemplate.headers }
          : {}),
    });
  }

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

  if (entry.id === "engram") {
    await uninstallEngramRuntime();
  } else if (entry.id === "memorix") {
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
