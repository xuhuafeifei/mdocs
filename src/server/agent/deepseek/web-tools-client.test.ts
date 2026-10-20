import { describe, expect, it, vi } from "vitest";
import { deepseekWebFetch, deepseekWebSearch } from "./web-tools-client.js";

describe("deepseekWebSearch", () => {
  it("POST /v1/tools/search 并解析 results", async () => {
    let seenUrl = "";
    let seenBody = "";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seenUrl = String(input);
      seenBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          results: [
            {
              rerank_score: 2,
              title: "Hello",
              url: "https://example.com",
              snippet: "snip",
              summary: "sum",
              content: "",
              site_name: "Example",
              site_icon: null,
              date: null,
              authority: 3,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const out = await deepseekWebSearch(
      { query: "DeepSeek", count: 5 },
      { apiKey: "sk-test", fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(seenUrl).toBe("https://api.deepseek.com/v1/tools/search");
    expect(JSON.parse(seenBody)).toMatchObject({
      query: "DeepSeek",
      count: 5,
      need_content: false,
    });
    expect(out.results[0]?.title).toBe("Hello");
  });

  it("非 2xx 抛出可读错误", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "balance low" } }), {
        status: 402,
      }),
    );
    await expect(
      deepseekWebSearch(
        { query: "x" },
        { apiKey: "sk", fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/balance low/);
  });
});

describe("deepseekWebFetch", () => {
  it("拒绝带凭证的 URL", async () => {
    await expect(
      deepseekWebFetch(
        { url: "https://user:pass@example.com/" },
        { apiKey: "sk" },
      ),
    ).rejects.toThrow(/credentials/);
  });
});
