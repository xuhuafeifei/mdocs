import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { VisitorRow } from "../../infra/db/repositories/visitor.repo.js";
import { VisitorError } from "../../modules/visitor/visitor.service.js";
import { VisitorContext } from "../context/visitor.context.js";

function resolveVisitor(ctx: ExecutionContext): VisitorRow | null {
  return (
    VisitorContext.visitor() ??
    ctx.switchToHttp().getRequest<Request>().visitor ??
    null
  );
}

/** 注入当前访客 ID；无访客时 401（配合 RequireVisitorGuard） */
export const VisitorId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const visitor = resolveVisitor(ctx);
    if (!visitor) {
      throw new VisitorError("UNAUTHENTICATED", "no visitor", 401);
    }
    return visitor.visitor_id;
  },
);

/**
 * 注入访客 ID，允许未登录（返回 null）。
 * 用于树/图谱等「有身份更好、没有也能试」的接口。
 */
export const OptionalVisitorId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    return resolveVisitor(ctx)?.visitor_id ?? null;
  },
);

/** 注入完整 VisitorRow；无访客时 401 */
export const CurrentVisitor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): VisitorRow => {
    const visitor = resolveVisitor(ctx);
    if (!visitor) {
      throw new VisitorError("UNAUTHENTICATED", "no visitor", 401);
    }
    return visitor;
  },
);
