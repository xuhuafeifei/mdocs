import { getVisitorAgentConfig, DEFAULT_AGENT_CONTEXT_WINDOW } from "../Config/config.js";
import { getSkillLoader } from "../Skill/skill-loader.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { createSkillTools } from "./tools.js";
import { createAccountTools } from "./tools-account.js";
import { AgentSessionManager } from "./session-manager.js";

export type AgentContextUsage = {
  percent: number;
  used: number;
  limit: number;
};

/** 粗估 token：CJK 约 1 字 1 token，其余约 4 字符 1 token */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff)
    ) {
      cjk += 1;
    } else {
      other += 1;
    }
  }
  return cjk + Math.ceil(other / 4);
}

function estimateToolsTokens(visitorId: string): number {
  const skills = getSkillLoader();
  const tools = skills.isReady()
    ? [...createSkillTools(skills), ...createAccountTools(visitorId)]
    : createAccountTools(visitorId);
  let total = 0;
  for (const t of tools) {
    total += estimateTokens(t.name);
    total += estimateTokens(t.description ?? "");
    try {
      total += estimateTokens(JSON.stringify(t.parameters ?? {}));
    } catch {
      /* ignore */
    }
  }
  return total;
}

function resolveContextLimit(visitorId: string): number {
  return getVisitorAgentConfig(visitorId)?.contextWindow ?? DEFAULT_AGENT_CONTEXT_WINDOW;
}

/**
 * 估算当前 lastOpened session 将占用的 context（system + tools + messages）。
 * limit 来自访客 AI 配置的 contextWindow。
 */
export async function getAgentContextUsageForApi(
  visitorId: string,
): Promise<AgentContextUsage> {
  const limit = resolveContextLimit(visitorId);
  const systemTokens = estimateTokens(buildSystemPrompt());
  const toolTokens = estimateToolsTokens(visitorId);
  const { messages } = await new AgentSessionManager(visitorId).loadLastOpenedMessages();
  let messageTokens = 0;
  for (const m of messages) {
    messageTokens += estimateTokens(m.content);
  }
  const used = Math.min(limit, systemTokens + toolTokens + messageTokens);
  const percent = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return { percent, used, limit };
}

/** 合并估算与本轮 provider usage.input（取较大者，避免低估） */
export function mergeContextUsage(
  estimated: AgentContextUsage,
  providerInputTokens?: number,
): AgentContextUsage {
  const limit = estimated.limit;
  const used = Math.min(
    limit,
    Math.max(estimated.used, Math.max(0, Math.floor(providerInputTokens ?? 0))),
  );
  const percent = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return { percent, used, limit };
}
