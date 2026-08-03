import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createDocumentTools } from "./tools-documents.js";
import { createDomainTools } from "./tools-domains.js";
import { createVisitorTools } from "./tools-visitors.js";
import { createChoiceTools, type ChoiceToolHooks } from "./tools-choice.js";
import {
  createOverwriteTools,
  type OverwriteToolHooks,
} from "./tools-overwrite.js";

export type AccountToolsOptions = {
  /** Ask 挂覆写；coding 关掉，避免绕过 hunk 审阅 */
  withOverwrite?: boolean;
};

function isOverwriteHooks(
  hooks: ChoiceToolHooks | undefined,
): hooks is OverwriteToolHooks {
  return !!hooks && typeof (hooks as OverwriteToolHooks).onOpenCoding === "function";
}

/** 账号/结构操作 tools；带 hooks 时另挂 choice；Ask 另挂覆写。 */
export function createAccountTools(
  visitorId: string,
  choiceHooks?: ChoiceToolHooks,
  options: AccountToolsOptions = {},
): AgentTool[] {
  const withOverwrite = options.withOverwrite !== false;
  const base = [
    ...createVisitorTools(visitorId),
    ...createDomainTools(visitorId),
    ...createDocumentTools(visitorId),
  ];
  const withChoice = choiceHooks
    ? [...base, ...createChoiceTools(visitorId, choiceHooks)]
    : base;
  if (withOverwrite && isOverwriteHooks(choiceHooks)) {
    return [...withChoice, ...createOverwriteTools(visitorId, choiceHooks)];
  }
  return withChoice;
}
