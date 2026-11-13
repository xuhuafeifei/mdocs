import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { VisitorError } from "../../modules/visitor/visitor.service.js";

/** 要求 authMiddleware 已解析出 req.visitor；否则 401 */
@Injectable()
export class NestRequireVisitorGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.visitor) {
      throw new VisitorError("UNAUTHENTICATED", "no visitor", 401);
    }
    return true;
  }
}
