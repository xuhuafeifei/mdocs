import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { asToolResult, type ToolDeps } from "./tool-deps";
import {
  DEFAULT_SKILL_FORM_TIMEOUT_MS,
  waitForSkillForm,
} from "./skill-form-pending";
import {
  createUserSkill,
  getUserSkillByName,
  listUserSkills,
  removeUserSkillByName,
  updateUserSkillByName,
} from "./user-skills";

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
      "列出当前访客已保存的私人 Skill（含纯 prompt 与流水线 upsert 的用法说明）。返回 name / description / updatedAt，不含正文；需要正文时调用 get_user_skill。名称对本访客唯一。",
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

/** 读取单个 skill 的完整内容，供 Agent 修改前获取版本。 */
export function getUserSkillTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "get_user_skill",
    label: "读取私人 Skill",
    description:
      "按 name 读取私人 Skill 的完整 description、body 与 updatedAt。修改前先读取，并把 updatedAt 传给 update_user_skill。",
    parameters: Type.Object({
      name: Type.String({ description: "要读取的 skill 名称" }),
    }),
    execute: async (_id, params) => {
      const name = String((params as { name?: string }).name ?? "").trim();
      if (!name) throw new Error("skill_name_required");
      const skill = getUserSkillByName(visitorId, name);
      if (!skill) return asToolResult({ status: "error", error: "skill_not_found", name });
      return asToolResult({ status: "found", skill });
    },
  };
}

/** 删除：按 name，无前端卡 */
export function deleteUserSkillTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "delete_user_skill",
    label: "删除私人 Skill",
    description:
      "按 name 删除私人 Skill。name 须为已存在的英文、数字、下划线或连字符名称。删除前可用 list_user_skills 确认。无额外确认卡。",
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
    mode: "create",
    title: params.title,
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
    const saved = createUserSkill({
      ownerVisitorId: params.visitorId,
      name: result.name,
      description: result.description,
      body: result.body,
    });
    return asToolResult({ status: "created", skill: saved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return asToolResult({ status: "error", error: msg });
  }
}

/** 新增：弹出表单卡。 */
export function createUserSkillTool({
  visitorId,
  onEvent,
  signal,
}: ToolDeps): AgentTool {
  return {
    name: "create_user_skill",
    label: "新建私人 Skill",
    description:
      "新建**纯 prompt Skill**：打包指令文案（无 clone/安装）。打开表单填名称/简介/正文，带倒计时。若需要 git 仓库、二进制、MCP 或可执行脚本，不要用本工具，应引导用户去插件流水线（git_clone/download/exec + upsert_skill）。名称须英文、数字、下划线或连字符（不能以 - 开头）且对本访客唯一。",
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

/** 修改：Agent 直接写入；expectedUpdatedAt 防止覆盖并发编辑。 */
export function updateUserSkillTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "update_user_skill",
    label: "修改私人 Skill",
    description:
      "直接修改已有私人 Skill 正文（纯 prompt 或流水线写入的用法说明）。先 get_user_skill 取完整正文和 updatedAt，再提交；expectedUpdatedAt 不一致时拒绝覆盖。改安装物请走流水线重装，不要只改 Skill 文案冒充安装。newName 可选，仍须英文、数字、下划线或连字符（不能以 - 开头）且唯一。",
    parameters: Type.Object({
      name: Type.String({ description: "要修改的 skill 当前名称" }),
      newName: Type.Optional(Type.String({ description: "可选的新名称" })),
      description: Type.String({ description: "完整的新简介" }),
      body: Type.String({ description: "完整的新正文" }),
      expectedUpdatedAt: Type.String({
        description: "get_user_skill 返回的 updatedAt，用于防止覆盖并发修改",
      }),
    }),
    execute: async (_id, params) => {
      const p = params as {
        name?: string;
        newName?: string;
        description?: string;
        body?: string;
        expectedUpdatedAt?: string;
      };
      const currentName = String(p.name ?? "").trim();
      if (!currentName) throw new Error("skill_name_required");
      try {
        const skill = updateUserSkillByName({
          ownerVisitorId: visitorId,
          currentName,
          name: typeof p.newName === "string" && p.newName.trim()
            ? p.newName
            : currentName,
          description: p.description,
          body: String(p.body ?? ""),
          expectedUpdatedAt: String(p.expectedUpdatedAt ?? ""),
        });
        return asToolResult({ status: "updated", skill });
      } catch (err) {
        return asToolResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          name: currentName,
        });
      }
    },
  };
}

export function userSkillTools(deps: ToolDeps): AgentTool[] {
  return [
    listUserSkillsTool(deps),
    getUserSkillTool(deps),
    createUserSkillTool(deps),
    updateUserSkillTool(deps),
    deleteUserSkillTool(deps),
  ];
}
