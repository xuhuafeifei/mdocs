import { Allow } from "class-validator";

/**
 * PUT members：优先 `members: { visitorId, role }[]`；兼容旧 `visitorIds`。
 * 形状校验在 application 内完成。
 */
export class ReplaceDomainMembersRequest {
  @Allow()
  members?: unknown;

  @Allow()
  visitorIds?: unknown;
}
