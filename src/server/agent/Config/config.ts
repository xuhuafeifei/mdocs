import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getDb } from "../../db/connection.js";
import {
  countAgentModelConfigsByOwner,
  deleteAgentModelConfig,
  findAgentModelConfigById,
  findDefaultAgentModelConfigByOwner,
  insertAgentModelConfig,
  listAgentModelConfigsByOwner,
  setDefaultAgentModelConfig,
  updateAgentModelConfig,
  type AgentModelConfigRow,
} from "../../db/repositories/agent-model-config.repo.js";
import {
  deleteAgentApiKey,
  getAgentApiKey,
  readAllAgentApiKeys,
  setAgentApiKey,
} from "../../secrets/secrets-store.js";

export const DEEPSEEK_ENDPOINT = "https://api.deepseek.com";

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

export const AGENT_MODEL_IDS = ["deepseek-flash", "deepseek-v4-pro"] as const;
export type AgentModelId = (typeof AGENT_MODEL_IDS)[number];
export type AgentConfigKind = "deepseek" | "custom";
export type AgentApiType = "openai-completions" | "anthropic-messages";

/** DeepSeek Flash / Pro 官方上下文均为 1M */
export const DEFAULT_AGENT_CONTEXT_WINDOW = 1_000_000;

/**
 * 旧模型名仍可调通，但服务端已切到 V4.1 Flash；写入配置时归一到 deepseek-flash。
 * @see https://api-docs.deepseek.com/ （模型名 deepseek-flash）
 */
const DEEPSEEK_FLASH_ALIASES = new Set([
  "deepseek-flash",
  "deepseek-v4-flash",
  "deepseek-v4-flash-vision-exp",
  "deepseek-v4.1-flash",
  "deepseek-v4.1-flash-expires-on-0910",
]);

const DEEPSEEK_PRESET = {
  baseUrl: DEEPSEEK_ENDPOINT,
  apiType: "openai-completions" as AgentApiType,
  compatJson: JSON.stringify({
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
  }),
};

export function agentProviderLabel(cfg: Pick<VisitorAgentConfig, "kind" | "providerId" | "name">): string {
  if (cfg.kind === "deepseek") return "Deepseek";
  return cfg.providerId ?? cfg.name;
}

export type AgentCompat = {
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
};

export type VisitorAgentConfig = {
  id: string;
  ownerVisitorId: string;
  kind: AgentConfigKind;
  providerId: string | null;
  name: string;
  baseUrl: string;
  apiType: AgentApiType;
  modelId: string;
  apiKey: string;
  contextWindow: number;
  compat: AgentCompat | null;
  isDefault: boolean;
};

export type PublicAgentConfig = Omit<VisitorAgentConfig, "apiKey" | "ownerVisitorId"> & {
  hasApiKey: boolean;
  apiKeyMasked: string | null;
};

export function isAgentModelId(v: string): v is AgentModelId {
  return (AGENT_MODEL_IDS as readonly string[]).includes(v);
}

/** 将 DeepSeek 官方/历史别名归一为白名单模型 id */
export function normalizeDeepseekModelId(raw: string | undefined | null): AgentModelId {
  const id = (raw ?? "").trim();
  if (id === "deepseek-v4-pro") return "deepseek-v4-pro";
  if (DEEPSEEK_FLASH_ALIASES.has(id) || id === "deepseek-flash") return "deepseek-flash";
  if (isAgentModelId(id)) return id;
  return "deepseek-flash";
}

export function normalizeContextWindow(
  value: unknown,
  fallback = DEFAULT_AGENT_CONTEXT_WINDOW,
): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.floor(n);
  if (rounded < 1000) return fallback;
  return Math.min(rounded, 2_000_000);
}

function resolveConfigName(name: string | undefined, visitorName: string, kind: AgentConfigKind): string {
  const t = name?.trim();
  if (t) return t;
  return kind === "custom" ? `${visitorName}的自定义配置` : `${visitorName}的 ds 配置`;
}

export function maskApiKey(apiKey: string): string {
  return apiKey.length <= 4 ? "…" : `…${apiKey.slice(-4)}`;
}

function parseCompat(raw: string | null): AgentCompat | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgentCompat;
  } catch {
    return null;
  }
}

function rowToConfig(row: AgentModelConfigRow): VisitorAgentConfig | null {
  if (!row.base_url) return null;
  const apiKey = getAgentApiKey(row.id) ?? "";
  if (!apiKey && !row.api_key) return null;
  // 兼容：DB 里还有 api_key 说明迁移没跑过，优先用 secrets 的，没有就用 DB 的
  const effectiveApiKey = apiKey || row.api_key;
  return {
    id: row.id,
    ownerVisitorId: row.owner_visitor_id,
    kind: row.kind === "custom" ? "custom" : "deepseek",
    providerId: row.provider_id,
    name: row.name,
    baseUrl: row.base_url,
    apiType: row.api_type === "anthropic-messages" ? "anthropic-messages" : "openai-completions",
    modelId: row.model_id,
    apiKey: effectiveApiKey,
    contextWindow: normalizeContextWindow(row.context_window),
    compat: parseCompat(row.compat_json),
    isDefault: row.is_default === 1,
  };
}

let apiKeysMigrated = false;

/**
 * 把 DB 里的旧 api_key 迁移到 secrets 文件。
 * 幂等：只迁 DB 里有、secrets 里没有的。
 * 迁完后不清空 DB 字段（兼容旧代码读 DB），
 * 新代码优先读 secrets，DB 里的仅作兼容兜底。
 */
function migrateApiKeysFromDbIfNeeded(): void {
  if (apiKeysMigrated) return;
  apiKeysMigrated = true;

  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, api_key FROM agent_model_configs
         WHERE api_key IS NOT NULL AND api_key != ''`,
      )
      .all() as Array<{ id: string; api_key: string }>;
    if (rows.length === 0) return;

    const existing = readAllAgentApiKeys();
    let migrated = 0;
    for (const row of rows) {
      if (!existing[row.id]) {
        setAgentApiKey(row.id, row.api_key);
        migrated++;
      }
    }
    if (migrated > 0) {
      console.log(`[agent-config] migrated ${migrated} api keys from DB to secrets file`);
    }
  } catch (err) {
    // 迁移失败不影响运行，顶多继续读 DB
    console.warn("[agent-config] migrate api keys failed:", err);
  }
}

export function getVisitorAgentConfig(visitorId: string): VisitorAgentConfig | null {
  migrateApiKeysFromDbIfNeeded();
  const row = findDefaultAgentModelConfigByOwner(getDb(), visitorId);
  return row ? rowToConfig(row) : null;
}

export function listVisitorAgentConfigs(visitorId: string): PublicAgentConfig[] {
  migrateApiKeysFromDbIfNeeded();
  return listAgentModelConfigsByOwner(getDb(), visitorId)
    .map((row) => rowToConfig(row))
    .filter((cfg): cfg is VisitorAgentConfig => cfg !== null)
    .map(toPublicAgentConfig);
}

export function toPublicAgentConfig(cfg: VisitorAgentConfig): PublicAgentConfig {
  const { apiKey, ownerVisitorId: _, ...rest } = cfg;
  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
    apiKeyMasked: apiKey ? maskApiKey(apiKey) : null,
  };
}

function buildConfigRow(input: {
  ownerVisitorId: string;
  visitorName: string;
  id: string;
  existing: AgentModelConfigRow | null;
  kind?: string;
  modelId?: string;
  name?: string;
  contextWindow?: number;
  providerId?: string;
  baseUrl?: string;
  apiType?: string;
  isDefault: boolean;
}): AgentModelConfigRow {
  const existing = input.existing;

  const kind: AgentConfigKind = input.kind === "custom" ? "custom" : "deepseek";
  const name =
    input.name !== undefined
      ? resolveConfigName(input.name, input.visitorName, kind)
      : existing?.name ?? resolveConfigName(undefined, input.visitorName, kind);
  const contextWindow = normalizeContextWindow(input.contextWindow ?? existing?.context_window);
  const updated_at = new Date().toISOString();

  if (kind === "custom") {
    const baseUrlRaw = (input.baseUrl ?? existing?.base_url ?? "").trim().replace(/\/+$/, "");
    if (!baseUrlRaw.startsWith("https://")) throw new Error("invalid_base_url");
    let hostname = "";
    try {
      hostname = new URL(baseUrlRaw).hostname;
    } catch {
      throw new Error("invalid_base_url");
    }
    const providerIdRaw = input.providerId?.trim() ?? existing?.provider_id ?? hostname;
    const providerId = providerIdRaw || null;
    if (providerId && !/^[a-z0-9][a-z0-9._-]*$/.test(providerId)) {
      throw new Error("invalid_provider_id");
    }
    const apiType =
      (input.apiType ?? existing?.api_type) === "anthropic-messages"
        ? "anthropic-messages"
        : "openai-completions";
    const modelId = (input.modelId ?? existing?.model_id ?? "").trim();
    if (!modelId) throw new Error("model_id_required");

    return {
      id: input.id,
      owner_visitor_id: input.ownerVisitorId,
      name,
      provider: "custom",
      kind: "custom",
      provider_id: providerId,
      base_url: baseUrlRaw,
      api_type: apiType,
      compat_json: null,
      model_id: modelId,
      api_key: "", // apiKey 存 secrets 文件，DB 不再存明文
      context_window: contextWindow,
      is_default: input.isDefault ? 1 : 0,
      updated_at,
    };
  }

  const modelId = normalizeDeepseekModelId(input.modelId ?? existing?.model_id);

  return {
    id: input.id,
    owner_visitor_id: input.ownerVisitorId,
    name,
    provider: "deepseek",
    kind: "deepseek",
    provider_id: null,
    base_url: DEEPSEEK_PRESET.baseUrl,
    api_type: DEEPSEEK_PRESET.apiType,
    compat_json: DEEPSEEK_PRESET.compatJson,
    model_id: modelId,
    api_key: "", // apiKey 存 secrets 文件，DB 不再存明文
    context_window: contextWindow,
    is_default: input.isDefault ? 1 : 0,
    updated_at,
  };
}

/** 新建或更新配置；无 id 为新建，有 id 为更新 */
export function upsertVisitorAgentConfig(input: {
  ownerVisitorId: string;
  visitorName: string;
  id?: string;
  isDefault?: boolean;
  kind?: string;
  modelId?: string;
  apiKey?: string;
  name?: string;
  contextWindow?: number;
  providerId?: string;
  baseUrl?: string;
  apiType?: string;
}): VisitorAgentConfig {
  const db = getDb();
  const existing = input.id
    ? findAgentModelConfigById(db, input.id, input.ownerVisitorId)
    : null;
  if (input.id && !existing) throw new Error("config_not_found");

  // apiKey 校验：新建必须传，更新可选（不传就保留原有）
  let apiKeyToSave: string;
  if (input.apiKey !== undefined && input.apiKey.trim()) {
    apiKeyToSave = input.apiKey.trim();
  } else if (existing) {
    const existingKey = getAgentApiKey(existing.id) ?? existing.api_key;
    apiKeyToSave = existingKey;
  } else {
    throw new Error("api_key_required");
  }
  if (!apiKeyToSave) throw new Error("api_key_required");

  const total = countAgentModelConfigsByOwner(db, input.ownerVisitorId);
  const makeDefault =
    input.isDefault === true ||
    (!input.id && total === 0) ||
    (existing?.is_default === 1 && input.isDefault !== false);

  const row = buildConfigRow({
    ...input,
    id: input.id ?? randomUUID(),
    existing: existing ?? null,
    isDefault: false,
  });

  if (existing) {
    row.is_default = makeDefault ? 1 : 0;
    updateAgentModelConfig(db, row);
  } else {
    insertAgentModelConfig(db, row);
  }

  if (makeDefault) {
    setDefaultAgentModelConfig(db, input.ownerVisitorId, row.id);
  }

  // apiKey 存 secrets 文件
  setAgentApiKey(row.id, apiKeyToSave);

  return rowToConfig(findAgentModelConfigById(db, row.id, input.ownerVisitorId)!)!;
}

export function setVisitorDefaultAgentConfig(ownerVisitorId: string, configId: string): PublicAgentConfig {
  const db = getDb();
  setDefaultAgentModelConfig(db, ownerVisitorId, configId);
  const cfg = findAgentModelConfigById(db, configId, ownerVisitorId);
  if (!cfg) throw new Error("config_not_found");
  const parsed = rowToConfig(cfg);
  if (!parsed) throw new Error("config_not_found");
  return toPublicAgentConfig(parsed);
}

export function deleteVisitorAgentConfig(ownerVisitorId: string, configId: string): void {
  const db = getDb();
  const existing = findAgentModelConfigById(db, configId, ownerVisitorId);
  if (!existing) throw new Error("config_not_found");

  const wasDefault = existing.is_default === 1;
  deleteAgentModelConfig(db, configId, ownerVisitorId);
  deleteAgentApiKey(configId);

  if (!wasDefault) return;

  const next = listAgentModelConfigsByOwner(db, ownerVisitorId)[0];
  if (next) {
    setDefaultAgentModelConfig(db, ownerVisitorId, next.id);
  }
}

export function resolveSkillsRoot(): string | null {
  const override = process.env.MDOCS_AGENT_SKILLS_DIR?.trim();
  if (override) return fs.existsSync(override) ? path.resolve(override) : null;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const skills = path.join(dir, "agent-skills");
    if (fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(skills, "index.json"))) {
      return skills;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
