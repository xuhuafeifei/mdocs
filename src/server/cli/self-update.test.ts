import { describe, expect, it } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
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
