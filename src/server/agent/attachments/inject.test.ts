import { describe, expect, it } from "vitest";
import { buildUserContentParts, partsToPiPrompt } from "./inject.js";
import type { AssetMeta, ParseResult } from "./types.js";

const meta = (name: string): AssetMeta => ({
  id: "a1",
  sessionId: "s1",
  ownerVisitorId: "v1",
  sha256: "abc",
  name,
  mime: "text/plain",
  bytes: 3,
  status: "persisted",
  createdAt: new Date().toISOString(),
});

describe("buildUserContentParts", () => {
  it("embeds text attachment", () => {
    const parts = buildUserContentParts("看看这个", [
      { meta: meta("a.txt"), result: { kind: "text", text: "hi" } },
    ]);
    expect(parts.some((p) => p.type === "text" && p.text.includes("hi"))).toBe(true);
    expect(parts[0]).toEqual({ type: "text", text: "看看这个" });
  });

  it("embeds image as data url then pi image", () => {
    const data = new Uint8Array([1, 2, 3]);
    const result: ParseResult = { kind: "image", mime: "image/png", data };
    const parts = buildUserContentParts("图", [{ meta: meta("x.png"), result }]);
    const pi = partsToPiPrompt(parts);
    expect(pi.images).toHaveLength(1);
    expect(pi.images[0]?.mimeType).toBe("image/png");
    expect(pi.text).toContain("图");
  });

  it("deferred becomes hint text", () => {
    const parts = buildUserContentParts("", [
      {
        meta: meta("big.pdf"),
        result: { kind: "deferred", reason: "needs_tool", hint: "用 tool" },
      },
    ]);
    expect(parts.some((p) => p.type === "text" && p.text.includes("read_attachment"))).toBe(
      true,
    );
  });
});
