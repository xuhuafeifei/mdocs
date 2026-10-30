import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("loadSoulPromptSection", () => {
  let dataDir = "";

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-soul-"));
    vi.stubEnv("MDOCS_DATA_DIR", dataDir);
    const { resetConfigCacheForTests } = await import("../config/index.js");
    resetConfigCacheForTests();
  });

  afterEach(async () => {
    const { resetConfigCacheForTests } = await import("../config/index.js");
    resetConfigCacheForTests();
    vi.unstubAllEnvs();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("creates shells and includes global + visitor mdocs", async () => {
    const { loadSoulPromptSection } = await import("./load-for-agent.js");
    const text = loadSoulPromptSection("visitor-a");
    expect(text).toContain("mdocs 灵魂约定");
    expect(text).toContain("全局灵魂");
    expect(text).toContain("个人灵魂");
    expect(
      fs.existsSync(path.join(dataDir, "soul", "mdocs.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(dataDir, "tenant", "visitor-a", "soul", "mdocs.md")),
    ).toBe(true);
  });

  it("includes sidecar md next to mdocs", async () => {
    const { loadSoulPromptSection } = await import("./load-for-agent.js");
    loadSoulPromptSection("visitor-a");
    fs.writeFileSync(
      path.join(dataDir, "soul", "engram.md"),
      "# Engram sidecar\nremember things",
      "utf8",
    );
    const text = loadSoulPromptSection("visitor-a");
    expect(text).toContain("engram.md");
    expect(text).toContain("remember things");
  });
});
