import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-plugins-"));

vi.mock("../config/index.js", () => ({
  getConfig: () => ({
    dataDir: tmpRoot,
  }),
}));

vi.mock("./memorix-runtime.js", () => ({
  MEMORIX_HTTP_MCP_URL: "http://127.0.0.1:3211/mcp",
  installMemorixRuntime: vi.fn(async () => {}),
  uninstallMemorixRuntime: vi.fn(async () => {}),
  isMemorixHttpUp: vi.fn(async () => true),
}));

vi.mock("./engram-runtime.js", () => ({
  ENGRAM_PROJECT_NAME: "mdocs-bootstrap",
  engramBinaryPath: () => path.join(tmpRoot, "plugins", "engram", "bin", "engram"),
  engramWorkspaceRoot: () => path.join(tmpRoot, "plugins-data", "engram", "workspace"),
  buildEngramMcpEnv: () => ({
    ENGRAM_DATA_DIR: path.join(tmpRoot, "plugins-data", "engram"),
    ENGRAM_PROJECT: "mdocs-bootstrap",
  }),
  installEngramRuntime: vi.fn(async () => {}),
  uninstallEngramRuntime: vi.fn(async () => {}),
  isEngramBinaryReady: vi.fn(() => true),
}));

import { getMcpServerById } from "../mcp/mcp-servers-store.js";
import {
  getPluginInstallJob,
  resetPluginInstallJobsForTests,
  startPluginInstall,
} from "./plugin-install-job.js";
import { installEngramRuntime, uninstallEngramRuntime } from "./engram-runtime.js";
import { installMemorixRuntime, uninstallMemorixRuntime } from "./memorix-runtime.js";
import { installPlugin, listPlugins, uninstallPlugin } from "./plugins-store.js";

describe("plugins-store", () => {
  beforeEach(() => {
    resetPluginInstallJobsForTests();
    for (const name of ["plugins.json", "mcp-servers.json"]) {
      const p = path.join(tmpRoot, name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  afterEach(() => {
    for (const name of ["plugins.json", "mcp-servers.json"]) {
      const p = path.join(tmpRoot, name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it("lists engram and memorix uninstalled by default", () => {
    const plugins = listPlugins();
    expect(plugins.find((p) => p.id === "engram")).toMatchObject({
      installed: false,
      mcpServer: null,
    });
    expect(plugins.find((p) => p.id === "memorix")).toMatchObject({
      installed: false,
      mcpServer: null,
    });
  });

  it("install engram writes stdio mcp entry", async () => {
    const plugin = await installPlugin("engram");
    expect(installEngramRuntime).toHaveBeenCalledOnce();
    expect(plugin.installed).toBe(true);
    expect(plugin.mcpServer?.id).toBe("plugin-engram");
    expect(plugin.mcpServer?.transport).toBe("stdio");
    expect(plugin.mcpServer?.command).toContain("engram");
    expect(plugin.mcpServer?.args).toEqual(["mcp", "--project=mdocs-bootstrap"]);
    expect(plugin.mcpServer?.cwd).toContain("engram");
    expect(plugin.mcpServer?.env?.ENGRAM_PROJECT).toBe("mdocs-bootstrap");
    expect(getMcpServerById("plugin-engram")?.name).toBe("Engram");
  });

  it("install memorix installs the runtime and writes the local mcp url", async () => {
    const plugin = await installPlugin("memorix");
    expect(installMemorixRuntime).toHaveBeenCalledOnce();
    expect(plugin.installed).toBe(true);
    expect(plugin.mcpServer?.id).toBe("plugin-memorix");
    expect(plugin.mcpServer?.url).toBe("http://127.0.0.1:3211/mcp");
    expect(plugin.mcpServer?.enabled).toBe(true);
    expect(getMcpServerById("plugin-memorix")?.name).toBe("Memorix");
  });

  it("install job finishes in the background and reports done", async () => {
    const started = startPluginInstall("engram");
    expect(started.finishedAt).toBeNull();
    expect(started.phase).toBe("npm");
    await vi.waitFor(() => {
      expect(getPluginInstallJob("engram")?.phase).toBe("done");
    });
    expect(getPluginInstallJob("engram")?.finishedAt).toBeTruthy();
    const lines = (getPluginInstallJob("engram")?.logs ?? []).map((log) =>
      typeof log.data?.line === "string" ? log.data.line : log.event,
    );
    expect(lines).toContain("安装成功");
    expect(listPlugins().find((p) => p.id === "engram")?.installed).toBe(true);
  });

  it("uninstall engram removes the mcp entry", async () => {
    await installPlugin("engram");
    const after = await uninstallPlugin("engram");
    expect(uninstallEngramRuntime).toHaveBeenCalledOnce();
    expect(after.installed).toBe(false);
    expect(getMcpServerById("plugin-engram")).toBeNull();
  });

  it("uninstall memorix stops the runtime and removes the mcp entry", async () => {
    await installPlugin("memorix");
    const after = await uninstallPlugin("memorix");
    expect(uninstallMemorixRuntime).toHaveBeenCalledOnce();
    expect(after.installed).toBe(false);
    expect(getMcpServerById("plugin-memorix")).toBeNull();
  });
});
