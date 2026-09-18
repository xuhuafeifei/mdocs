import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  chmodPackageBins,
  MDOCS_UPDATE_PACKAGE,
  MDOCS_UPDATE_REGISTRY,
  resolveInstalledPackageRoot,
} from "./self-update.js";

describe("self-update constants", () => {
  it("hardcodes npmmirror and package name", () => {
    expect(MDOCS_UPDATE_REGISTRY).toBe("https://registry.npmmirror.com");
    expect(MDOCS_UPDATE_PACKAGE).toBe("@fgbg/mdocs");
  });
});

describe("resolveInstalledPackageRoot", () => {
  it("walks up from dist/server/cli to package root", () => {
    const fake = pathToFileURL(
      path.join("/tmp/fake-mdocs/dist/server/cli/self-update.js"),
    ).href;
    expect(resolveInstalledPackageRoot(fake)).toBe(
      path.normalize("/tmp/fake-mdocs"),
    );
  });
});

describe("chmodPackageBins", () => {
  it("sets package bin scripts to 755 even if copied as 644", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-bin-"));
    const binDir = path.join(root, "bin");
    fs.mkdirSync(binDir);
    const script = path.join(binDir, "mdocs.js");
    fs.writeFileSync(script, "#!/usr/bin/env node\n");
    fs.chmodSync(script, 0o644);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ bin: { mdocs: "bin/mdocs.js" } }),
    );
    chmodPackageBins(root);
    expect(fs.statSync(script).mode & 0o777).toBe(0o755);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
