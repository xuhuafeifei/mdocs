/**
 * DeepSeek 网页搜索 / 抓取（仅 kind=deepseek 时由 registry 挂载）。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  deepseekWebFetch,
  deepseekWebSearch,
} from "../deepseek/web-tools-client.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

export function webSearchTool(deps: ToolDeps): AgentTool {
  return {
    name: "web_search",
    label: "网页搜索",
    description:
      "用 DeepSeek 搜索引擎检索公开网页（非本库文档）。适合时事、官方文档、外站资料。" +
      "返回标题、链接、摘要；needContent=true 时可带正文（更贵/更慢，默认 false）。" +
      "库内文章请用 search_documents。可用 site: / after: 等搜索语法。",
    parameters: Type.Object({
      query: Type.String({
        description: "搜索词，1～128 字符；可含 site: lang: after: 等语法",
      }),
      count: Type.Optional(
        Type.Number({ description: "返回条数，默认 8，最大 20" }),
      ),
      oriQuestion: Type.Optional(
        Type.String({ description: "触发搜索的用户原话，有助于意图理解" }),
      ),
      needContent: Type.Optional(
        Type.Boolean({
          description: "是否返回网页正文；默认 false，仅摘要即可时不要开",
        }),
      ),
    }),
    execute: async (_id, params) => {
      const web = deps.deepseekWeb;
      if (!web?.apiKey) throw new Error("web_search requires DeepSeek API key");
      const { query, count, oriQuestion, needContent } = params as {
        query: string;
        count?: number;
        oriQuestion?: string;
        needContent?: boolean;
      };
      const q = query?.trim();
      if (!q) throw new Error("query is required");
      const limit = Math.min(Math.max(Math.floor(count ?? 8), 1), 20);
      const { results } = await deepseekWebSearch(
        {
          query: q,
          count: limit,
          oriQuestion,
          needContent: needContent === true,
        },
        {
          apiKey: web.apiKey,
          baseUrl: web.baseUrl,
          signal: deps.signal,
        },
      );
      return asToolResult({
        query: q,
        count: results.length,
        results: results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          summary: r.summary,
          content: needContent === true ? r.content : undefined,
          siteName: r.site_name,
          siteIcon: r.site_icon,
          date: r.date,
          authority: r.authority,
          rerankScore: r.rerank_score,
        })),
      });
    },
  };
}

export function webFetchTool(deps: ToolDeps): AgentTool {
  return {
    name: "web_fetch",
    label: "抓取网页",
    description:
      "抓取单个公开网页，返回标题与 Markdown 正文（DeepSeek Fetch）。" +
      "用于在 web_search 选中链接后精读；勿抓需登录或内网地址。",
    parameters: Type.Object({
      url: Type.String({ description: "http(s) URL，不含用户名密码" }),
    }),
    execute: async (_id, params) => {
      const web = deps.deepseekWeb;
      if (!web?.apiKey) throw new Error("web_fetch requires DeepSeek API key");
      const url = String((params as { url?: string }).url ?? "").trim();
      if (!url) throw new Error("url is required");
      const page = await deepseekWebFetch(
        { url },
        {
          apiKey: web.apiKey,
          baseUrl: web.baseUrl,
          signal: deps.signal,
        },
      );
      return asToolResult({
        url,
        title: page.title,
        content: page.content,
        chars: page.content.length,
      });
    },
  };
}

/** kind=deepseek 且有 key 时挂载 */
export function deepseekWebTools(deps: ToolDeps): AgentTool[] {
  if (!deps.deepseekWeb?.apiKey) return [];
  return [webSearchTool(deps), webFetchTool(deps)];
}
