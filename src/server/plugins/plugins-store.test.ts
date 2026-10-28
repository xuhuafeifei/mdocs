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

import { getMcpServerById } from "../mcp/mcp-servers-store.js";
import {
  getPluginInstallJob,
  resetPluginInstallJobsForTests,
  startPluginInstall,
} from "./plugin-install-job.js";
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

  it("lists memorix uninstalled by default", () => {
    const plugins = listPlugins();
    const memorix = plugins.find((p) => p.id === "memorix");
    expect(memorix).toBeTruthy();
    expect(memorix!.installed).toBe(false);
    expect(memorix!.mcpServer).toBeNull();
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
    const started = startPluginInstall("memorix");
    expect(started.finishedAt).toBeNull();
    expect(started.phase).toBe("npm");
    await vi.waitFor(() => {
      expect(getPluginInstallJob("memorix")?.phase).toBe("done");
    });
    expect(getPluginInstallJob("memorix")?.finishedAt).toBeTruthy();
    const lines = (getPluginInstallJob("memorix")?.logs ?? []).map((log) =>
      typeof log.data?.line === "string" ? log.data.line : log.event,
    );
    expect(lines).toContain("安装成功");
    expect(listPlugins().find((p) => p.id === "memorix")?.installed).toBe(true);
  });

  it("uninstall stops the runtime and removes the mcp entry", async () => {
    await installPlugin("memorix");
    const after = await uninstallPlugin("memorix");
    expect(uninstallMemorixRuntime).toHaveBeenCalledOnce();
    expect(after.installed).toBe(false);
    expect(getMcpServerById("plugin-memorix")).toBeNull();
  });
});
