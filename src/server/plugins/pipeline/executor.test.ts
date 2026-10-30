import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCacheForTests } from "../../config/index.js";
import { resolveUninstallSteps, runPipeline } from "./executor.js";
import type { PluginPipeline } from "./types.js";
import type { PipelineRunEvent } from "./executor.js";

const PIPELINE: PluginPipeline = {
  id: "test-plugin",
  name: "Test Plugin",
  kind: "tenant",
  outputs: ["mcp"],
  steps: [
    {
      type: "upsert_mcp",
      name: "Test MCP",
      enabled: true,
      transport: "http",
      url: "http://127.0.0.1:9/mcp",
    },
    {
      type: "write_soul_sidecar",
      scope: "global",
      file: "test-plugin.md",
      content: "# Test plugin",
    },
  ],
  uninstall: [
    { type: "delete_soul_sidecar", scope: "global", file: "test-plugin.md" },
    { type: "remove_mcp" },
  ],
};

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

describe("pipeline executor", () => {
  let dataDir = "";

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-exec-"));
    process.env.MDOCS_DATA_DIR = dataDir;
    resetConfigCacheForTests();
  });

  afterEach(() => {
    resetConfigCacheForTests();
    delete process.env.MDOCS_DATA_DIR;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("installs MCP + soul sidecar and records install state", async () => {
    const events: PipelineRunEvent[] = [];
    await runPipeline({
      pipeline: PIPELINE,
      action: "install",
      visitorId: "v1",
      onEvent: (e) => events.push(e),
    });

    const servers = readJson<{ servers: Array<{ id: string; url?: string }> }>(
      path.join(dataDir, "mcp-servers.json"),
    );
    const server = servers.servers.find((s) => s.id === "plugin-test-plugin");
    expect(server?.url).toBe("http://127.0.0.1:9/mcp");

    const sidecar = path.join(dataDir, "soul", "test-plugin.md");
    expect(fs.readFileSync(sidecar, "utf8")).toContain("Test plugin");

    const plugins = readJson<{
      pipelines: { installed: Array<{ id: string; mcpServerId?: string }> };
    }>(path.join(dataDir, "plugins.json"));
    expect(plugins.pipelines.installed[0]).toMatchObject({
      id: "test-plugin",
      mcpServerId: "plugin-test-plugin",
    });
    expect(
      fs.existsSync(path.join(dataDir, "plugins", "install", "test-plugin")),
    ).toBe(true);
    expect(
      events.some((e) => e.type === "done"),
    ).toBe(true);
  });

  it("skips steps when probes already pass", async () => {
    fs.mkdirSync(path.join(dataDir, "plugins", "install", "probe-plugin", "bin"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(dataDir, "plugins", "install", "probe-plugin", "bin", "x"),
      "ok",
    );
    const pipeline: PluginPipeline = {
      id: "probe-plugin",
      name: "Probe Plugin",
      kind: "tenant",
      outputs: ["mcp"],
      probe: [{ type: "file_exists", path: "bin/x" }],
      steps: [
        { type: "download", url: "https://example.invalid/never.tar.gz" },
        {
          type: "upsert_mcp",
          name: "Probe MCP",
          transport: "http",
          url: "http://127.0.0.1:9/mcp",
        },
      ],
    };
    const statuses: string[] = [];
    await runPipeline({
      pipeline,
      action: "install",
      visitorId: "v1",
      onEvent: (e) => {
        if (e.type === "step") statuses.push(e.status);
      },
    });
    expect(statuses).toContain("skipped");
    expect(statuses).toContain("done");
  });

  it("derives uninstall steps when pipeline has none", () => {
    const steps = resolveUninstallSteps({
      id: "no-uninstall",
      name: "No Uninstall",
      kind: "tenant",
      outputs: ["mcp"],
      steps: [
        {
          type: "upsert_mcp",
          name: "X",
          transport: "http",
          url: "http://127.0.0.1:9/mcp",
        },
        {
          type: "write_soul_sidecar",
          scope: "global",
          file: "x.md",
          content: "x",
        },
        {
          type: "upsert_skill",
          name: "x_skill",
          body: "x",
        },
      ],
    });
    expect(steps.map((s) => s.type)).toEqual([
      "delete_soul_sidecar",
      "remove_skill",
      "remove_mcp",
    ]);
  });

  it("removes the MCP id recorded at install even when uninstall omits it", async () => {
    const pipeline: PluginPipeline = {
      id: "custom-mcp",
      name: "Custom MCP",
      kind: "tenant",
      outputs: ["mcp"],
      steps: [
        {
          type: "upsert_mcp",
          mcp_server_id: "my-custom-id",
          name: "Custom",
          transport: "http",
          url: "http://127.0.0.1:9/mcp",
        },
      ],
      uninstall: [{ type: "remove_mcp" }],
    };
    await runPipeline({
      pipeline,
      action: "install",
      visitorId: "v1",
      onEvent: () => {},
    });
    await runPipeline({
      pipeline,
      action: "uninstall",
      visitorId: "v1",
      onEvent: () => {},
    });
    const servers = readJson<{ servers: Array<{ id: string }> }>(
      path.join(dataDir, "mcp-servers.json"),
    );
    expect(servers.servers.find((s) => s.id === "my-custom-id")).toBeUndefined();
  });

  it("uninstalls sidecar + MCP and removes install dir but keeps data dir", async () => {
    await runPipeline({
      pipeline: PIPELINE,
      action: "install",
      visitorId: "v1",
      onEvent: () => {},
    });
    fs.mkdirSync(path.join(dataDir, "plugins-data", "test-plugin"), {
      recursive: true,
    });
    await runPipeline({
      pipeline: PIPELINE,
      action: "uninstall",
      visitorId: "v1",
      onEvent: () => {},
    });

    expect(fs.existsSync(path.join(dataDir, "soul", "test-plugin.md"))).toBe(false);
    const servers = readJson<{ servers: Array<{ id: string }> }>(
      path.join(dataDir, "mcp-servers.json"),
    );
    expect(servers.servers.find((s) => s.id === "plugin-test-plugin")).toBeUndefined();
    expect(
      fs.existsSync(path.join(dataDir, "plugins", "install", "test-plugin")),
    ).toBe(false);
    expect(fs.existsSync(path.join(dataDir, "plugins-data", "test-plugin"))).toBe(true);
    const plugins = readJson<{ pipelines: { installed: unknown[] } }>(
      path.join(dataDir, "plugins.json"),
    );
    expect(plugins.pipelines.installed).toEqual([]);
  });
});