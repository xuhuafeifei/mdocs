import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { asToolResult, type ToolDeps } from "./tool-deps.js";
import {
  DEFAULT_SKILL_FORM_TIMEOUT_MS,
  waitForSkillForm,
} from "./skill-form-pending.js";
import {
  createUserSkill,
  getUserSkillByName,
  listUserSkills,
  removeUserSkillByName,
  updateUserSkillByName,
} from "./user-skills.js";

function formTimeoutMs(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw)
    ? raw
    : DEFAULT_SKILL_FORM_TIMEOUT_MS;
}

/** 罗列本人私人 skill（无定制前端） */
export function listUserSkillsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "list_user_skills",
    label: "列出私人 Skill",
    description:
      "列出当前访客已保存的私人 Agent Skill。返回 name / description / updatedAt（不含正文全文时可再 update 打开表单查看）。名称全局（对本访客）唯一，交互请用 name。",
    parameters: Type.Object({}),
    execute: async () => {
      const skills = listUserSkills(visitorId).map((s) => ({
        name: s.name,
        description: s.description,
        updatedAt: s.updatedAt,
        bodyChars: s.body.length,
      }));
      return asToolResult({ count: skills.length, skills });
    },
  };
}

/** 删除：按 name，无前端卡 */
export function deleteUserSkillTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "delete_user_skill",
    label: "删除私人 Skill",
    description:
      "按 name 删除私人 Skill。name 须为已存在的英文数字下划线名称。删除前可用 list_user_skills 确认。无额外确认卡。",
    parameters: Type.Object({
      name: Type.String({ description: "要删除的 skill 名称" }),
    }),
    execute: async (_id, params) => {
      const name = String((params as { name?: string }).name ?? "").trim();
      if (!name) throw new Error("skill_name_required");
      removeUserSkillByName(visitorId, name);
      return asToolResult({ deleted: true, name });
    },
  };
}

async function runSkillForm(params: {
  visitorId: string;
  onEvent: ToolDeps["onEvent"];
  signal?: AbortSignal;
  mode: "create" | "update";
  currentName?: string;
  initial: { name: string; description: string; body: string };
  title: string;
  timeoutMs: number;
}) {
  const { requestId, promise } = waitForSkillForm({
    visitorId: params.visitorId,
    timeoutMs: params.timeoutMs,
    signal: params.signal,
  });
  const expiresAt = new Date(Date.now() + params.timeoutMs).toISOString();
  params.onEvent({
    type: "skill_form_card",
    requestId,
    mode: params.mode,
    title: params.title,
    currentName: params.currentName,
    initialName: params.initial.name,
    initialDescription: params.initial.description,
    initialBody: params.initial.body,
    expiresAt,
  });

  const result = await promise;
  if (result.status === "timeout") {
    params.onEvent({ type: "skill_form_expired", requestId });
    return asToolResult({ status: "timeout", message: "用户未在时限内提交表单" });
  }
  if (result.status === "cancelled") {
    return asToolResult({ status: "cancelled", message: "表单已取消" });
  }

  try {
    if (params.mode === "create") {
      const saved = createUserSkill({
        ownerVisitorId: params.visitorId,
        name: result.name,
        description: result.description,
        body: result.body,
      });
      return asToolResult({ status: "created", skill: saved });
    }
    const saved = updateUserSkillByName({
      ownerVisitorId: params.visitorId,
      currentName: params.currentName!,
      name: result.name,
      description: result.description,
      body: result.body,
    });
    return asToolResult({ status: "updated", skill: saved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return asToolResult({ status: "error", error: msg });
  }
}

/** 新增：弹出表单卡（与 update 同 UI） */
export function createUserSkillTool({
  visitorId,
  onEvent,
  signal,
}: ToolDeps): AgentTool {
  return {
    name: "create_user_skill",
    label: "新建私人 Skill",
    description:
      "打开表单让用户填写新的私人 Skill（名称 / 简介 / 正文），带倒计时。名称须全英文数字下划线且对本访客唯一；简介可用中英文。用户提交后写入；超时/取消则不创建。",
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "表单标题" })),
      suggestedName: Type.Optional(
        Type.String({ description: "预填名称（须符合命名规则）" }),
      ),
      suggestedDescription: Type.Optional(Type.String()),
      suggestedBody: Type.Optional(Type.String()),
      timeoutMs: Type.Optional(Type.Number()),
    }),
    execute: async (_id, params) => {
      const p = params as {
        title?: string;
        suggestedName?: string;
        suggestedDescription?: string;
        suggestedBody?: string;
        timeoutMs?: number;
      };
      return runSkillForm({
        visitorId,
        onEvent,
        signal,
        mode: "create",
        title: (p.title ?? "新建 Skill").trim() || "新建 Skill",
        initial: {
          name: typeof p.suggestedName === "string" ? p.suggestedName : "",
          description:
            typeof p.suggestedDescription === "string" ? p.suggestedDescription : "",
          body: typeof p.suggestedBody === "string" ? p.suggestedBody : "",
        },
        timeoutMs: formTimeoutMs(p.timeoutMs),
      });
    },
  };
}

/** 修改：先指定 name，再弹出预填表单 */
export function updateUserSkillTool({
  visitorId,
  onEvent,
  signal,
}: ToolDeps): AgentTool {
  return {
    name: "update_user_skill",
    label: "修改私人 Skill",
    description:
      "按 name 打开表单修改已有私人 Skill（名称 / 简介 / 正文），带倒计时。须先知道要改哪个 name（可先 list_user_skills）。用户可改名（仍须英文数字下划线且唯一）。",
    parameters: Type.Object({
      name: Type.String({ description: "要修改的 skill 当前名称" }),
      title: Type.Optional(Type.String()),
      timeoutMs: Type.Optional(Type.Number()),
    }),
    execute: async (_id, params) => {
      const p = params as { name?: string; title?: string; timeoutMs?: number };
      const currentName = String(p.name ?? "").trim();
      if (!currentName) throw new Error("skill_name_required");
      const existing = getUserSkillByName(visitorId, currentName);
      if (!existing) {
        return asToolResult({
          status: "error",
          error: "skill_not_found",
          name: currentName,
        });
      }
      return runSkillForm({
        visitorId,
        onEvent,
        signal,
        mode: "update",
        currentName: existing.name,
        title: (p.title ?? `修改 Skill：${existing.name}`).trim() || "修改 Skill",
        initial: {
          name: existing.name,
          description: existing.description,
          body: existing.body,
        },
        timeoutMs: formTimeoutMs(p.timeoutMs),
      });
    },
  };
}

export function userSkillTools(deps: ToolDeps): AgentTool[] {
  return [
    listUserSkillsTool(deps),
    createUserSkillTool(deps),
    updateUserSkillTool(deps),
    deleteUserSkillTool(deps),
  ];
}
