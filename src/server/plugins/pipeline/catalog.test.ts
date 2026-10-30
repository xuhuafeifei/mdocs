import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCacheForTests } from "../../config/index.js";
import {
  createVisitorPipeline,
  ensureSystemPipelinesSeeded,
  listSystemPipelines,
  listVisitorPipelines,
  readPipelineYaml,
  resetSystemPipeline,
  writePipelineYaml,
} from "./catalog.js";

describe("pipeline catalog", () => {
  let dataDir = "";

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-pipe-"));
    process.env.MDOCS_DATA_DIR = dataDir;
    resetConfigCacheForTests();
  });

  afterEach(() => {
    resetConfigCacheForTests();
    delete process.env.MDOCS_DATA_DIR;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("seeds system Engram pipeline", () => {
    ensureSystemPipelinesSeeded();
    const list = listSystemPipelines();
    expect(list.some((p) => p.runtime === "engram")).toBe(true);
    const engram = list.find((p) => p.runtime === "engram")!;
    const yaml = readPipelineYaml("system", engram.id);
    expect(yaml).toContain("runtime: engram");
  });

  it("creates and lists visitor pipelines", () => {
    const { id } = createVisitorPipeline("v1", { name: "我的MCP" });
    const list = listVisitorPipelines("v1");
    expect(list.some((p) => p.id === id)).toBe(true);
    const yaml = readPipelineYaml("tenant", id, "v1");
    expect(yaml).toContain(id);
  });

  it("resets system pipeline to default", () => {
    ensureSystemPipelinesSeeded();
    const engram = listSystemPipelines().find((p) => p.runtime === "engram")!;
    writePipelineYaml(
      "system",
      engram.id,
      [
        `id: "${engram.id}"`,
        "name: Engram",
        "kind: system",
        "runtime: engram",
        "outputs: [mcp]",
        "steps:",
        "  - type: extract",
        "",
      ].join("\n"),
    );
    const restored = resetSystemPipeline(engram.id);
    expect(restored).toContain("write_soul_sidecar");
    expect(restored).not.toContain("url_template");
    expect(restored).not.toContain("mdocs-template");
  });
});
