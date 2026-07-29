import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getDb } from "../../db/connection.js";
import {
  findAgentModelConfigByOwner,
  upsertAgentModelConfig,
} from "../../db/repositories/agent-model-config.repo.js";

export const DEEPSEEK_ENDPOINT = "https://api.deepseek.com";

/** 已部署 mdocs-site 文档根（写死）；skill source 去掉 .md 后拼 .html */
export const MDOCS_SITE_DOCS_BASE =
  "https://xuhuafeifei.github.io/mdocs-site/docs";

export function skillSourceToUrl(source: string | undefined): string | null {
  if (!source?.trim()) return null;
  const pathPart = source
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\//, "")
    .replace(/\.(md|mdx)$/i, "");
  if (!pathPart || pathPart.includes("..")) return null;
  return `${MDOCS_SITE_DOCS_BASE}/${pathPart}.html`;
}

export const AGENT_MODEL_IDS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
export type AgentModelId = (typeof AGENT_MODEL_IDS)[number];

/** 默认 context window；可在设置页按访客覆盖 */
export const DEFAULT_AGENT_CONTEXT_WINDOW = 128_000;

export function isAgentModelId(value: string): value is AgentModelId {
  return (AGENT_MODEL_IDS as readonly string[]).includes(value);
}

export function normalizeContextWindow(value: unknown, fallback = DEFAULT_AGENT_CONTEXT_WINDOW): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.floor(n);
  if (rounded < 1000) return fallback;
  if (rounded > 2_000_000) return 2_000_000;
  return rounded;
}

export interface VisitorAgentConfig {
  id: string;
  ownerVisitorId: string;
  name: string;
  provider: "deepseek";
  modelId: AgentModelId;
  apiKey: string;
  endpoint: string;
  contextWindow: number;
}

export interface PublicAgentConfig {
  id: string;
  name: string;
  modelId: AgentModelId;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  contextWindow: number;
}

/** 空白 name → `{visitorName}的 ds 配置` */
export function resolveConfigName(name: string | undefined, visitorName: string): string {
  const trimmed = name?.trim() ?? "";
  if (trimmed) return trimmed;
  return `${visitorName}的 ds 配置`;
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return "…";
  return `…${apiKey.slice(-4)}`;
}

export function getVisitorAgentConfig(visitorId: string): VisitorAgentConfig | null {
  const row = findAgentModelConfigByOwner(getDb(), visitorId);
  if (!row || !row.api_key || !isAgentModelId(row.model_id)) return null;
  return {
    id: row.id,
    ownerVisitorId: row.owner_visitor_id,
    name: row.name,
    provider: "deepseek",
    modelId: row.model_id,
    apiKey: row.api_key,
    endpoint: DEEPSEEK_ENDPOINT,
    contextWindow: normalizeContextWindow(row.context_window),
  };
}

export function toPublicAgentConfig(cfg: VisitorAgentConfig): PublicAgentConfig {
  return {
    id: cfg.id,
    name: cfg.name,
    modelId: cfg.modelId,
    hasApiKey: Boolean(cfg.apiKey),
    apiKeyMasked: cfg.apiKey ? maskApiKey(cfg.apiKey) : null,
    contextWindow: cfg.contextWindow,
  };
}

export function upsertVisitorAgentConfig(input: {
  ownerVisitorId: string;
  visitorName: string;
  modelId: AgentModelId;
  name?: string;
  apiKey?: string;
  contextWindow?: number;
}): VisitorAgentConfig {
  const existing = findAgentModelConfigByOwner(getDb(), input.ownerVisitorId);
  const apiKey =
    input.apiKey !== undefined ? input.apiKey.trim() : (existing?.api_key ?? "");
  if (!apiKey) {
    throw new Error("api_key_required");
  }

  const nameProvided = input.name !== undefined;
  const name = nameProvided
    ? resolveConfigName(input.name, input.visitorName)
    : existing?.name
      ? existing.name
      : resolveConfigName(undefined, input.visitorName);

  const contextWindow = normalizeContextWindow(
    input.contextWindow !== undefined
      ? input.contextWindow
      : existing?.context_window ?? DEFAULT_AGENT_CONTEXT_WINDOW,
  );

  const row = {
    id: existing?.id ?? randomUUID(),
    owner_visitor_id: input.ownerVisitorId,
    name,
    provider: "deepseek",
    model_id: input.modelId,
    api_key: apiKey,
    context_window: contextWindow,
    updated_at: new Date().toISOString(),
  };
  upsertAgentModelConfig(getDb(), row);

  return {
    id: row.id,
    ownerVisitorId: row.owner_visitor_id,
    name: row.name,
    provider: "deepseek",
    modelId: input.modelId,
    apiKey: row.api_key,
    endpoint: DEEPSEEK_ENDPOINT,
    contextWindow,
  };
}

/** 包根下的 agent-skills/，或 MDOCS_AGENT_SKILLS_DIR */
export function resolveSkillsRoot(): string | null {
  const override = process.env.MDOCS_AGENT_SKILLS_DIR?.trim();
  if (override) {
    return fs.existsSync(override) ? path.resolve(override) : null;
  }
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(dir, "package.json");
    const skills = path.join(dir, "agent-skills");
    if (fs.existsSync(pkg) && fs.existsSync(path.join(skills, "index.json"))) {
      return skills;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
