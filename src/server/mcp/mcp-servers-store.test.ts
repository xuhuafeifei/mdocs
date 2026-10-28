import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-mcp-"));

vi.mock("../config/index.js", () => ({
  getConfig: () => ({
    dataDir: tmpRoot,
  }),
}));

import {
  listEnabledMcpServers,
  listMcpServers,
  normalizeMcpServerInput,
  replaceMcpServers,
} from "./mcp-servers-store.js";

describe("mcp-servers-store", () => {
  beforeEach(() => {
    const p = path.join(tmpRoot, "mcp-servers.json");
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  afterEach(() => {
    const p = path.join(tmpRoot, "mcp-servers.json");
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  it("normalize rejects bad url", () => {
    expect(() =>
      normalizeMcpServerInput({ name: "x", url: "not-a-url" }),
    ).toThrow(/url/);
  });

  it("normalize accepts stdio", () => {
    const s = normalizeMcpServerInput({
      name: "Engram",
      transport: "stdio",
      command: "/opt/engram",
      args: ["mcp"],
      env: { ENGRAM_PROJECT: "mdocs" },
    });
    expect(s.transport).toBe("stdio");
    expect(s.command).toBe("/opt/engram");
    expect(s.args).toEqual(["mcp"]);
    expect(s.env?.ENGRAM_PROJECT).toBe("mdocs");
  });

  it("replace + list + enabled filter", () => {
    const saved = replaceMcpServers([
      {
        id: "a",
        name: "Memorix",
        enabled: true,
        transport: "http",
        url: "http://127.0.0.1:3211/mcp",
      },
      {
        id: "b",
        name: "Off",
        enabled: false,
        url: "https://example.com/mcp",
      },
      {
        id: "c",
        name: "Engram",
        enabled: true,
        transport: "stdio",
        command: "/bin/engram",
        args: ["mcp"],
      },
    ]);
    expect(saved).toHaveLength(3);
    expect(listMcpServers()).toHaveLength(3);
    expect(listEnabledMcpServers().map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      replaceMcpServers([
        { id: "dup", name: "A", url: "http://127.0.0.1/mcp" },
        { id: "dup", name: "B", url: "http://127.0.0.1/mcp2" },
      ]),
    ).toThrow(/duplicate/);
  });
});
