import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createDocumentTools } from "./tools-documents.js";
import { createDomainTools } from "./tools-domains.js";
import { createVisitorTools } from "./tools-visitors.js";

/** 账号/结构操作 tools（不写正文）；与手册 tools 一并交给 Pi。 */
export function createAccountTools(visitorId: string): AgentTool[] {
  return [
    ...createVisitorTools(visitorId),
    ...createDomainTools(visitorId),
    ...createDocumentTools(visitorId),
  ];
}
