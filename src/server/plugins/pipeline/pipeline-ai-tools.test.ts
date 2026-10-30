import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertPublicUrl,
  cleanupPipelineAiWorkspace,
  createPipelineAiWorkspace,
  executePipelineAiTool,
  type PipelineAiToolContext,
} from "./pipeline-ai-tools.js";

describe("pipeline AI tools", () => {
  let workspace = "";
  let ctx: PipelineAiToolContext;

  beforeEach(() => {
    workspace = createPipelineAiWorkspace();
    ctx = { workspace, deadline: Date.now() + 30_000, trace: [] };
  });

  afterEach(() => {
    cleanupPipelineAiWorkspace(workspace);
  });

  it("blocks private / local URLs", () => {
    expect(() => assertPublicUrl("http://127.0.0.1:4000/mcp")).toThrow(/内网/);
    expect(() => assertPublicUrl("http://localhost:3000")).toThrow(/内网/);
    expect(() => assertPublicUrl("http://192.168.1.2/a")).toThrow(/内网/);
    expect(() => assertPublicUrl("file:///etc/passwd")).toThrow(/http/);
    expect(assertPublicUrl("https://example.com/mcp").hostname).toBe("example.com");
  });

  it("runs exec in the workspace and records a trace", async () => {
    const result = await executePipelineAiTool(ctx, "exec", {
      command: process.execPath,
      args: ["--version"],
    });
    expect(result.ok).toBe(true);
    expect(result.text).toContain("exitCode");
    expect(ctx.trace[0]).toMatchObject({ tool: "exec", ok: true });
  });

  it("rejects dangerous commands", async () => {
    const result = await executePipelineAiTool(ctx, "exec", { command: "rm", args: ["-rf", "/"] });
    expect(result.ok).toBe(false);
    expect(result.text).toContain("禁用");
  });

  it("blocks install commands during translation", async () => {
    const result = await executePipelineAiTool(ctx, "exec", {
      command: "npm",
      args: ["install", "left-pad"],
    });
    expect(result.ok).toBe(false);
    expect(result.text).toContain("不允许安装命令");
  });

  it("lists and reads files inside the workspace", async () => {
    fs.mkdirSync(path.join(workspace, "pkg"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "pkg", "README.md"), "# hi");
    const listed = await executePipelineAiTool(ctx, "list_dir", { path: "pkg" });
    expect(listed.text).toContain("README.md");
    const read = await executePipelineAiTool(ctx, "read_file", { path: "pkg/README.md" });
    expect(read.text).toBe("# hi");
  });

  it("blocks path traversal", async () => {
    const result = await executePipelineAiTool(ctx, "read_file", { path: "../outside.txt" });
    expect(result.ok).toBe(false);
    expect(result.text).toContain("越界");
  });

  it("rejects a different id when editing an existing pipeline", async () => {
    const strict = { ...ctx, expectedId: "expected-id", expectedKind: "system" };
    const yaml = [
      "id: other-id",
      "name: Other",
      "kind: tenant",
      "outputs: [mcp]",
      "steps:",
      "  - type: upsert_mcp",
      "    name: Other",
      "    transport: http",
      "    url: https://example.com/mcp",
    ].join("\n");
    const result = await executePipelineAiTool(strict, "submit_pipeline", { yaml });
    expect(result.ok).toBe(false);
    expect(result.text).toContain("expected-id");
  });

  it("validates submitted pipeline YAML", async () => {
    const bad = await executePipelineAiTool(ctx, "submit_pipeline", { yaml: "name: x" });
    expect(bad.ok).toBe(false);
    expect(bad.submittedYaml).toBeUndefined();

    const yaml = [
      "id: demo",
      "name: Demo",
      "kind: tenant",
      "outputs: [mcp]",
      "steps:",
      "  - type: upsert_mcp",
      "    name: Demo",
      "    transport: http",
      "    url: https://example.com/mcp",
    ].join("\n");
    const good = await executePipelineAiTool(ctx, "submit_pipeline", { yaml });
    expect(good.ok).toBe(true);
    expect(good.submittedYaml).toContain("id: demo");
  });
});