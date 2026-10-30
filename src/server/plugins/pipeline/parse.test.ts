import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsePipelineYaml } from "./parse.js";

const demoPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../.mdocs-docs/requirements/plugin-pipeline/demos/engram.pipeline.yaml",
);

describe("parsePipelineYaml", () => {
  it("parses Engram demo yaml", () => {
    const raw = fs.readFileSync(demoPath, "utf8");
    const p = parsePipelineYaml(raw);
    expect(p.id).toBe("847291036512");
    expect(p.runtime).toBe("engram");
    expect(p.data_key).toBe("engram");
    expect(p.outputs).toContain("mcp");
    expect(p.steps.some((s) => s.type === "download")).toBe(true);
    expect(p.steps.some((s) => s.type === "upsert_mcp")).toBe(true);
    expect(p.steps.some((s) => s.type === "write_soul_sidecar")).toBe(true);
  });

  it("rejects missing id", () => {
    expect(() => parsePipelineYaml("name: x\noutputs: [mcp]\nsteps:\n  - type: extract\n")).toThrow(
      /id/,
    );
  });
});
