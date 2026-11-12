/**
 * 按主题写死注册单个 tool（不按 mode 组合；组合见 tools-registry）。
 */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ToolDeps } from "./tool-deps";
import {
  mdocsManualContentTool,
  mdocsManualOutlineTool,
} from "./tools";
import { listVisitorsTool } from "./tools-visitors";
import {
  addDomainMembersTool,
  createDomainTool,
  listDomainMembersTool,
  listDomainsTool,
  setDomainPermissionTool,
} from "./tools-domains";
import {
  createDocumentTool,
  createFolderTool,
  getDocumentCommitTool,
  getDocumentTool,
  inviteDocumentUserTool,
  listDocumentCommitsTool,
  listSemanticIndexTool,
  queryMyDocumentsTool,
  listTreeTool,
  moveDocumentTool,
  rebuildSemanticIndexTool,
  renameDocumentTool,
  searchDocumentsTool,
} from "./tools-documents";
import { askUserChoiceTool } from "./tools-choice";
import { overwriteDocumentTool } from "./tools-overwrite";
import { documentEditTools } from "./tools-document-edit";
import { documentMergeTools } from "./tools-merge";
import { editorDraftTools } from "./tools-editor-draft";
import { sheetTools } from "./tools-sheet";
import {
  getWorkingDocumentTool,
  setMarkdownDocumentTool,
} from "./tools-coding";
import { lexicalLinesTools } from "./tools-lexical-lines";
import { pluginCliTools } from "./tools-plugin-cli";
import { userSkillTools } from "./tools-user-skills";
import { getNowTool } from "./tools-time";
import { setThinkingLevelTool } from "./tools-thinking";
import { readAttachmentTool } from "../attachments/tools-read-attachment";
import { deepseekWebTools } from "./tools-web";
import { pipelineTools } from "./tools-pipeline";

/** 手册（skills 缺省时为空） */
export function manualTools(deps: ToolDeps): AgentTool[] {
  if (!deps.skills) return [];
  return [mdocsManualOutlineTool(deps), mdocsManualContentTool(deps)];
}

/** 与账号无关的轻量工具（Ask / 帮写都挂） */
export function utilityTools(deps: ToolDeps): AgentTool[] {
  return [
    getNowTool(),
    setThinkingLevelTool(deps),
    readAttachmentTool(deps),
    ...deepseekWebTools(deps),
  ];
}

/** 账号结构：访客 / 域 / 文档 */
export function accountTools(deps: ToolDeps): AgentTool[] {
  return [
    listVisitorsTool(deps),
    listDomainsTool(deps),
    createDomainTool(deps),
    listDomainMembersTool(deps),
    addDomainMembersTool(deps),
    setDomainPermissionTool(deps),
    searchDocumentsTool(deps),
    listTreeTool(deps),
    queryMyDocumentsTool(deps),
    listSemanticIndexTool(deps),
    rebuildSemanticIndexTool(deps),
    inviteDocumentUserTool(deps),
    getDocumentTool(deps),
    listDocumentCommitsTool(deps),
    getDocumentCommitTool(deps),
    createDocumentTool(deps),
    createFolderTool(deps),
    moveDocumentTool(deps),
    renameDocumentTool(deps),
    ...sheetTools(deps),
  ];
}

export function choiceTools(deps: ToolDeps): AgentTool[] {
  return [askUserChoiceTool(deps)];
}

export function overwriteTools(deps: ToolDeps): AgentTool[] {
  return [
    overwriteDocumentTool(deps),
    ...documentEditTools(deps),
    ...editorDraftTools(deps),
    ...documentMergeTools(deps),
    ...lexicalLinesTools(deps),
  ];
}

export function codingWriteTools(deps: ToolDeps): AgentTool[] {
  return [getWorkingDocumentTool(deps), setMarkdownDocumentTool(deps)];
}

/** 私人用户 skill CRUD（list/create/update/delete；create/update 出表单卡） */
export function userSkillManageTools(deps: ToolDeps): AgentTool[] {
  return userSkillTools(deps);
}

/** 插件 CLI 自测 + query_skill（相对路径，系统拼前缀） */
export function pluginCliManageTools(deps: ToolDeps): AgentTool[] {
  return pluginCliTools(deps);
}

/** 插件流水线编排：临时工作区探测 + submit + CLI 自测 */
export function pluginPipelineTools(deps: ToolDeps): AgentTool[] {
  return [...pipelineTools(deps), ...pluginCliTools(deps)];
}
