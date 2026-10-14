import { describe, expect, it } from "vitest";
import {
  assertUploadAllowed,
  findCapability,
  resolveParseStrategy,
} from "./capabilities.js";
import { DEFAULT_PARSE_LIMITS, type AssetMeta } from "./types.js";

describe("asset capabilities", () => {
  it("allows registered types", () => {
    expect(findCapability("a.PNG")?.ext).toBe(".png");
    expect(() => assertUploadAllowed("note.md", 10)).not.toThrow();
  });

  it("rejects unknown types", () => {
    expect(() => assertUploadAllowed("x.exe", 10)).toThrow("unsupported_type");
  });

  it("plain text strategy returns text", async () => {
    const parse = resolveParseStrategy("a.txt");
    const meta: AssetMeta = {
      id: "1",
      sessionId: "s",
      ownerVisitorId: "v",
      sha256: "x",
      name: "a.txt",
      mime: "text/plain",
      bytes: 5,
      status: "staging",
      createdAt: new Date().toISOString(),
    };
    const result = await parse({
      meta,
      data: new TextEncoder().encode("hello"),
      limits: DEFAULT_PARSE_LIMITS,
    });
    expect(result).toEqual({ kind: "text", text: "hello" });
  });
});
