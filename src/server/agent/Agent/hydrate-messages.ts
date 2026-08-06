/**
 * 用户 skill 用时展开：历史 / 本轮 → Pi messages。
 * - 合成 load_user_skill toolCall + toolResult（仿 Claude）
 * - 单次请求内同 skillId 全文只展开一次；越新越先标定展开点
 * - 用户原文不在此追加（本轮走 prompt）；历史 user 原文照常写入
 */
import { randomUUID } from "node:crypto";
import type { Model } from "@earendil-works/pi-ai";
import type { AgentSessionMessage } from "./session-manager.js";
import { skillRefsOfMessage } from "./session-manager.js";
import {
  formatSkillExpandBlock,
  resolveSkillExpandBlocks,
} from "./user-skills.js";

export const LOAD_USER_SKILL_TOOL = "load_user_skill";

const EMPTY_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

type PiUserMessage = { role: "user"; content: string; timestamp: number };

type PiAssistantToolMessage = {
  role: "assistant";
  content: [
    {
      type: "toolCall";
      id: string;
      name: typeof LOAD_USER_SKILL_TOOL;
      arguments: { id: string; name: string };
    },
  ];
  api: Model<any>["api"];
  provider: Model<any>["provider"];
  model: string;
  usage: typeof EMPTY_USAGE;
  stopReason: "toolUse";
  timestamp: number;
};

type PiToolResultMessage = {
  role: "toolResult";
  toolCallId: string;
  toolName: typeof LOAD_USER_SKILL_TOOL;
  content: [{ type: "text"; text: string }];
  isError: false;
  timestamp: number;
};

export type PiHydratedMessage =
  | PiUserMessage
  | PiAssistantToolMessage
  | PiToolResultMessage
  | {
      role: "assistant";
      content: [{ type: "text"; text: string }];
      api: Model<any>["api"];
      provider: Model<any>["provider"];
      model: string;
      usage: typeof EMPTY_USAGE;
      stopReason: "stop";
      timestamp: number;
    };

/** 从新到旧：每个 skill 引用（name，或旧 id）→ 最新出现的 user 轮下标 */
export function markSkillExpandPoints(
  history: AgentSessionMessage[],
): Map<string, number> {
  const expandAt = new Map<string, number>();
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m?.role !== "user") continue;
    const refs = skillRefsOfMessage(m);
    if (!refs.length) continue;
    for (const ref of refs) {
      if (!expandAt.has(ref)) expandAt.set(ref, i);
    }
  }
  return expandAt;
}

function buildSyntheticSkillPair(
  model: Model<any>,
  block: { id: string; name: string; content: string },
  timestamp: number,
): [PiAssistantToolMessage, PiToolResultMessage] {
  const toolCallId = `uskill-${randomUUID()}`;
  const assistant: PiAssistantToolMessage = {
    role: "assistant",
    content: [
      {
        type: "toolCall",
        id: toolCallId,
        name: LOAD_USER_SKILL_TOOL,
        arguments: { id: block.id, name: block.name },
      },
    ],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: EMPTY_USAGE,
    stopReason: "toolUse",
    timestamp,
  };
  const result: PiToolResultMessage = {
    role: "toolResult",
    toolCallId,
    toolName: LOAD_USER_SKILL_TOOL,
    content: [
      {
        type: "text",
        text: `[user skill loaded]\n${block.content}`,
      },
    ],
    isError: false,
    timestamp,
  };
  return [assistant, result];
}

/**
 * 仅产出本轮应预置的假 tool 对（不含用户原文）。
 * `alreadyExpanded`：历史 hydrate 已展开过的 id，本轮跳过。
 */
export function expandCurrentTurnSkillPairs(
  visitorId: string,
  skillNames: string[] | undefined,
  model: Model<any>,
  alreadyExpanded: ReadonlySet<string>,
  timestamp = Date.now(),
): Array<PiAssistantToolMessage | PiToolResultMessage> {
  const refs = (skillNames ?? []).filter((id) => id && !alreadyExpanded.has(id));
  if (refs.length === 0) return [];
  const blocks = resolveSkillExpandBlocks(visitorId, refs);
  const out: Array<PiAssistantToolMessage | PiToolResultMessage> = [];
  for (const b of blocks) {
    const [a, r] = buildSyntheticSkillPair(model, b, timestamp);
    out.push(a, r);
  }
  return out;
}

/**
 * 历史 → Pi messages。
 * `expandAt` 若传入（含本轮下标），按该表标定；否则仅就 history 从新到旧标定。
 */
export function hydrateSessionMessagesToPi(
  visitorId: string,
  history: AgentSessionMessage[],
  model: Model<any>,
  expandAt = markSkillExpandPoints(history),
): { messages: PiHydratedMessage[]; expandedSkillIds: Set<string> } {
  const ts = Date.now();
  const expandedSkillIds = new Set<string>();
  const out: PiHydratedMessage[] = [];

  for (let i = 0; i < history.length; i++) {
    const m = history[i]!;
    if (m.role === "assistant") {
      out.push({
        role: "assistant",
        content: [{ type: "text", text: m.content }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: EMPTY_USAGE,
        stopReason: "stop",
        timestamp: ts,
      });
      continue;
    }

    const refsThisTurn = skillRefsOfMessage(m).filter(
      (ref) => expandAt.get(ref) === i && !expandedSkillIds.has(ref),
    );
    if (refsThisTurn.length > 0) {
      const blocks = resolveSkillExpandBlocks(visitorId, refsThisTurn);
      for (const b of blocks) {
        const [a, r] = buildSyntheticSkillPair(model, b, ts);
        out.push(a, r);
        expandedSkillIds.add(b.name);
        expandedSkillIds.add(b.id);
        for (const ref of refsThisTurn) {
          if (ref === b.name || ref === b.id) expandedSkillIds.add(ref);
        }
      }
    }
    out.push({ role: "user", content: m.content, timestamp: ts });
  }

  return { messages: out, expandedSkillIds };
}

/** @deprecated 测试兼容：无 skill 时退化为单条 user */
export function expandUserMessageForPi(
  _visitorId: string,
  content: string,
  skillNames: string[] | undefined,
  timestamp: number,
): PiUserMessage[] {
  if (!skillNames?.length) {
    return [{ role: "user", content, timestamp }];
  }
  // 有 skill 时旧 API 不再内联正文；调用方应改用 expandCurrentTurnSkillPairs
  return [{ role: "user", content, timestamp }];
}

// re-export for tests
export { formatSkillExpandBlock };
