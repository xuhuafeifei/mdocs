import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetConfigCacheForTests } from "../config/index.js";
import {
  assertPluginCliArgs,
  listPluginHomeFiles,
  normalizePluginCliCommand,
  resolvePluginCliCwd,
  runPluginCli,
} from "./plugin-cli.js";
import { pluginHomeDir } from "./plugin-paths.js";

describe("plugin-cli", () => {
  let dataDir = "";

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-cli-"));
    process.env.MDOCS_DATA_DIR = dataDir;
    resetConfigCacheForTests();
  });

  afterEach(() => {
    resetConfigCacheForTests();
    delete process.env.MDOCS_DATA_DIR;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("rejects absolute and ~ paths in args", () => {
    expect(() => assertPluginCliArgs(["/tmp/x.py"])).toThrow(/绝对路径/);
    expect(() => assertPluginCliArgs(["~/x.py"])).toThrow(/绝对路径/);
    expect(() => assertPluginCliArgs(["../x.py"])).toThrow(/绝对路径/);
    expect(assertPluginCliArgs(["scripts/x.py", "--help"])).toEqual([
      "scripts/x.py",
      "--help",
    ]);
  });

  it("whitelists commands", () => {
    expect(normalizePluginCliCommand("python3")).toBe("python3");
    expect(() => normalizePluginCliCommand("bash")).toThrow(/白名单/);
  });

  it("resolves cwd under plugins-home", () => {
    const cwd = resolvePluginCliCwd({
      visitorId: "v1",
      pluginName: "ddwiki",
      cwd: "scripts",
    });
    expect(cwd).toBe(path.join(pluginHomeDir("ddwiki"), "scripts"));
  });

  it("runs python3 -c under plugin home", async () => {
    const home = pluginHomeDir("demo");
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, "hello.py"), "print('ok')\n");
    const result = await runPluginCli({
      visitorId: "v1",
      pluginName: "demo",
      command: "python3",
      args: ["hello.py"],
    });
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain("ok");
  });

  it("lists plugin home files", () => {
    const home = pluginHomeDir("pack");
    fs.mkdirSync(path.join(home, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(home, "scripts", "a.py"), "x");
    const listed = listPluginHomeFiles("pack");
    expect(listed.entries.some((e) => e.includes("a.py"))).toBe(true);
  });
});
