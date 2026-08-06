/**
 * 按主题写死注册单个 tool（不按 mode 组合；组合见 tools-registry）。
 */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ToolDeps } from "./tool-deps.js";
import {
  mdocsManualContentTool,
  mdocsManualOutlineTool,
} from "./tools.js";
import { listVisitorsTool } from "./tools-visitors.js";
import {
  addDomainMembersTool,
  createDomainTool,
  listDomainMembersTool,
  listDomainsTool,
} from "./tools-domains.js";
import {
  createDocumentTool,
  createFolderTool,
  getDocumentTool,
  listMyDocumentsTool,
  listTreeTool,
  moveDocumentTool,
  searchDocumentsTool,
} from "./tools-documents.js";
import { askUserChoiceTool } from "./tools-choice.js";
import { overwriteDocumentTool } from "./tools-overwrite.js";
import {
  getWorkingDocumentTool,
  setMarkdownDocumentTool,
} from "./tools-coding.js";
import { userSkillTools } from "./tools-user-skills.js";

/** 手册（skills 缺省时为空） */
export function manualTools(deps: ToolDeps): AgentTool[] {
  if (!deps.skills) return [];
  return [mdocsManualOutlineTool(deps), mdocsManualContentTool(deps)];
}

/** 账号结构：访客 / 域 / 文档 */
export function accountTools(deps: ToolDeps): AgentTool[] {
  return [
    listVisitorsTool(deps),
    listDomainsTool(deps),
    createDomainTool(deps),
    listDomainMembersTool(deps),
    addDomainMembersTool(deps),
    searchDocumentsTool(deps),
    listTreeTool(deps),
    listMyDocumentsTool(deps),
    getDocumentTool(deps),
    createDocumentTool(deps),
    createFolderTool(deps),
    moveDocumentTool(deps),
  ];
}

export function choiceTools(deps: ToolDeps): AgentTool[] {
  return [askUserChoiceTool(deps)];
}

export function overwriteTools(deps: ToolDeps): AgentTool[] {
  return [overwriteDocumentTool(deps)];
}

export function codingWriteTools(deps: ToolDeps): AgentTool[] {
  return [getWorkingDocumentTool(deps), setMarkdownDocumentTool(deps)];
}

/** 私人用户 skill CRUD（list/create/update/delete；create/update 出表单卡） */
export function userSkillManageTools(deps: ToolDeps): AgentTool[] {
  return userSkillTools(deps);
}
