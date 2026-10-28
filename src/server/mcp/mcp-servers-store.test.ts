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
  listEnabledHttpMcpServers,
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
    ]);
    expect(saved).toHaveLength(2);
    expect(listMcpServers()).toHaveLength(2);
    expect(listEnabledHttpMcpServers().map((s) => s.id)).toEqual(["a"]);
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
