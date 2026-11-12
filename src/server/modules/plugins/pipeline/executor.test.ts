import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCacheForTests } from "../../../infra/config";
import {
  decideGitCloneDestAction,
  isAllowedGitCloneUrl,
  normalizeGitRemoteForCompare,
  resolveUninstallSteps,
  runPipeline,
} from "./executor.js";
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

    const server = readJson<{ id: string; url?: string }>(
      path.join(dataDir, "tenant", "v1", "mcp", "test-plugin.json"),
    );
    expect(server.id).toBe("test-plugin");
    expect(server.url).toBe("http://127.0.0.1:9/mcp");

    const sidecar = path.join(dataDir, "soul", "test-plugin.md");
    expect(fs.readFileSync(sidecar, "utf8")).toContain("Test plugin");

    const plugins = readJson<{
      pipelines: { installed: Array<{ id: string; mcpServerId?: string }> };
    }>(path.join(dataDir, "plugins.json"));
    expect(plugins.pipelines.installed[0]).toMatchObject({
      id: "test-plugin",
      mcpServerId: "test-plugin",
    });
    expect(
      fs.existsSync(path.join(dataDir, "plugins-home", "test-plugin")),
    ).toBe(true);
    expect(
      events.some((e) => e.type === "done"),
    ).toBe(true);
  });

  it("skips steps when probes already pass", async () => {
    fs.mkdirSync(path.join(dataDir, "plugins-home", "probe-plugin", "bin"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(dataDir, "plugins-home", "probe-plugin", "bin", "x"),
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
    expect(
      fs.existsSync(path.join(dataDir, "tenant", "v1", "mcp", "my-custom-id.json")),
    ).toBe(false);
  });

  it("accepts https and ssh clone URLs", () => {
    expect(isAllowedGitCloneUrl("https://git.example/a/b.git")).toBe(true);
    expect(
      isAllowedGitCloneUrl("git@git.ddxq.mobi:xuhuafei/cfl-search-mcp.git"),
    ).toBe(true);
    expect(isAllowedGitCloneUrl("ssh://git@git.ddxq.mobi/xuhuafei/cfl-search-mcp.git")).toBe(
      true,
    );
    expect(isAllowedGitCloneUrl("file:///tmp/repo.git")).toBe(false);
    expect(isAllowedGitCloneUrl("git@host")).toBe(false);
  });

  it("normalizeGitRemoteForCompare equates https / ssh / scp forms", () => {
    expect(normalizeGitRemoteForCompare("https://git.example/a/b.git")).toBe(
      normalizeGitRemoteForCompare("git@git.example:a/b"),
    );
    expect(
      normalizeGitRemoteForCompare("ssh://git@git.example/a/b.git"),
    ).toBe(normalizeGitRemoteForCompare("https://git.example/a/b"));
  });

  it("decideGitCloneDestAction is re-entrant on leftover dest", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-clone-dest-"));
    const dest = path.join(root, "src");
    const url = "https://git.example/a/b.git";

    expect(
      decideGitCloneDestAction({
        destAbs: dest,
        destRel: "src",
        url,
        originUrl: null,
      }),
    ).toBe("clone");

    fs.mkdirSync(dest, { recursive: true });
    expect(
      decideGitCloneDestAction({
        destAbs: dest,
        destRel: "src",
        url,
        originUrl: null,
      }),
    ).toBe("clone");

    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, "junk.txt"), "x");
    expect(
      decideGitCloneDestAction({
        destAbs: dest,
        destRel: "src",
        url,
        originUrl: null,
      }),
    ).toBe("clone");
    expect(fs.existsSync(dest)).toBe(false);

    fs.mkdirSync(path.join(dest, ".git"), { recursive: true });
    expect(
      decideGitCloneDestAction({
        destAbs: dest,
        destRel: "src",
        url,
        originUrl: "https://git.example/a/b.git",
      }),
    ).toBe("sync");
    expect(fs.existsSync(dest)).toBe(true);

    fs.writeFileSync(path.join(dest, "other.txt"), "y");
    expect(
      decideGitCloneDestAction({
        destAbs: dest,
        destRel: "src",
        url,
        originUrl: "https://git.example/other/repo.git",
      }),
    ).toBe("clone");
    expect(fs.existsSync(dest)).toBe(false);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it("git_clone fails without hanging on interactive auth", async () => {
    const pipeline: PluginPipeline = {
      id: "clone-auth",
      name: "Clone Auth",
      kind: "tenant",
      outputs: ["mcp"],
      steps: [
        {
          type: "git_clone",
          // 需认证的地址：禁止 tty 后应快速失败，而不是 Username for … 卡死
          url: "https://127.0.0.1:9/private/repo.git",
          dest: "src",
          depth: 1,
        },
      ],
    };
    const started = Date.now();
    await expect(
      runPipeline({
        pipeline,
        action: "install",
        visitorId: "v1",
        onEvent: () => {},
      }),
    ).rejects.toThrow(/git_clone|失败|Authentication|could not read|Connection|refused|timed out|超时|禁止交互/i);
    expect(Date.now() - started).toBeLessThan(30_000);
  }, 35_000);

  it("uninstalls sidecar + MCP and removes install dir but keeps data dir", async () => {
    await runPipeline({
      pipeline: PIPELINE,
      action: "install",
      visitorId: "v1",
      onEvent: () => {},
    });
    const tenantData = path.join(
      dataDir,
      "tenant",
      "v1",
      "plugins-data",
      "test-plugin",
    );
    fs.mkdirSync(tenantData, { recursive: true });
    fs.writeFileSync(path.join(tenantData, "keep.txt"), "x");
    await runPipeline({
      pipeline: PIPELINE,
      action: "uninstall",
      visitorId: "v1",
      onEvent: () => {},
    });

    expect(fs.existsSync(path.join(dataDir, "soul", "test-plugin.md"))).toBe(false);
    expect(
      fs.existsSync(path.join(dataDir, "tenant", "v1", "mcp", "test-plugin.json")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(dataDir, "plugins-home", "test-plugin")),
    ).toBe(false);
    expect(fs.existsSync(path.join(tenantData, "keep.txt"))).toBe(true);
    const plugins = readJson<{ pipelines: { installed: unknown[] } }>(
      path.join(dataDir, "plugins.json"),
    );
    expect(plugins.pipelines.installed).toEqual([]);
  });
});