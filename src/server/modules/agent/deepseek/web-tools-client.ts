/**
 * DeepSeek Search / Fetch HTTP 客户端（与 Chat Completions 共用 API Key）。
 * @see https://api-docs.deepseek.com/zh-cn/guides/search/
 */

export type DeepSeekWebSearchHit = {
  rerank_score: number;
  title: string;
  url: string;
  snippet: string;
  summary: string;
  content: string;
  site_name: string | null;
  site_icon: string | null;
  date: string | null;
  authority: number;
};

export type DeepSeekWebSearchResponse = {
  results: DeepSeekWebSearchHit[];
};

export type DeepSeekWebFetchResponse = {
  title: string;
  content: string;
};

export type DeepSeekWebClientOptions = {
  apiKey: string;
  /** 默认 https://api.deepseek.com */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

function normalizeBaseUrl(baseUrl?: string): string {
  const raw = (baseUrl ?? "https://api.deepseek.com").trim().replace(/\/+$/, "");
  return raw || "https://api.deepseek.com";
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const body = text ? (JSON.parse(text) as { error?: { message?: string } }) : null;
    const msg = body?.error?.message?.trim();
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return text.trim().slice(0, 240) || `HTTP ${res.status}`;
}

export async function deepseekWebSearch(
  params: {
    query: string;
    count?: number;
    oriQuestion?: string;
    needContent?: boolean;
  },
  opts: DeepSeekWebClientOptions,
): Promise<DeepSeekWebSearchResponse> {
  const query = params.query.trim();
  if (!query) throw new Error("query is required");
  if ([...query].length > 128) throw new Error("query must be at most 128 characters");

  const count = Math.min(Math.max(Math.floor(params.count ?? 10), 1), 50);
  const body: Record<string, unknown> = {
    query,
    count,
    need_content: params.needContent === true,
  };
  const ori = params.oriQuestion?.trim();
  if (ori) body.ori_question = ori.slice(0, 128);

  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${normalizeBaseUrl(opts.baseUrl)}/v1/tools/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`DeepSeek Search failed: ${await readErrorMessage(res)}`);
  }
  const json = (await res.json()) as DeepSeekWebSearchResponse;
  return { results: Array.isArray(json.results) ? json.results : [] };
}

export async function deepseekWebFetch(
  params: { url: string },
  opts: DeepSeekWebClientOptions,
): Promise<DeepSeekWebFetchResponse> {
  const url = params.url.trim();
  if (!url) throw new Error("url is required");
  if (url.length > 8192) throw new Error("url is too long");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("url is invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must be http(s)");
  }
  if (parsed.username || parsed.password) {
    throw new Error("url must not include credentials");
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${normalizeBaseUrl(opts.baseUrl)}/v1/tools/fetch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`DeepSeek Fetch failed: ${await readErrorMessage(res)}`);
  }
  const json = (await res.json()) as DeepSeekWebFetchResponse;
  return {
    title: typeof json.title === "string" ? json.title : "",
    content: typeof json.content === "string" ? json.content : "",
  };
}
