import { createParamDecorator } from "@nestjs/common";
import type { VisitorRow } from "../../infra/db/repositories/visitor.repo.js";
import { VisitorError } from "../../modules/visitor/visitor.service.js";
import { VisitorContext } from "../context/visitor.context.js";

/** 注入当前访客 ID；无访客时 401（配合 RequireVisitorGuard） */
export const VisitorId = createParamDecorator((): string => {
  const visitor = VisitorContext.visitor();
  if (!visitor) {
    throw new VisitorError("UNAUTHENTICATED", "no visitor", 401);
  }
  return visitor.visitor_id;
});

/**
 * 注入访客 ID，允许未登录（返回 null）。
 * 用于树/图谱等「有身份更好、没有也能试」的接口。
 */
export const OptionalVisitorId = createParamDecorator((): string | null => {
  return VisitorContext.visitorId();
});

/** 注入完整 VisitorRow；无访客时 401 */
export const CurrentVisitor = createParamDecorator((): VisitorRow => {
  const visitor = VisitorContext.visitor();
  if (!visitor) {
    throw new VisitorError("UNAUTHENTICATED", "no visitor", 401);
  }
  return visitor;
});
