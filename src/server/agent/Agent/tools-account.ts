import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createDocumentTools } from "./tools-documents.js";
import { createDomainTools } from "./tools-domains.js";
import { createVisitorTools } from "./tools-visitors.js";
import { createChoiceTools, type ChoiceToolHooks } from "./tools-choice.js";

/** 账号/结构操作 tools（不写正文）；与手册 tools 一并交给 Pi。 */
export function createAccountTools(
  visitorId: string,
  choiceHooks?: ChoiceToolHooks,
): AgentTool[] {
  const base = [
    ...createVisitorTools(visitorId),
    ...createDomainTools(visitorId),
    ...createDocumentTools(visitorId),
  ];
  if (!choiceHooks) return base;
  return [...base, ...createChoiceTools(visitorId, choiceHooks)];
}
