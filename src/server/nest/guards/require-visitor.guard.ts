import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { VisitorError } from "../../modules/visitor/visitor.service.js";
import { VisitorContext } from "../context/visitor.context.js";

/** 要求已解析出访客（VisitorContext / req.visitor）；否则 401 */
@Injectable()
export class RequireVisitorGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const visitor = VisitorContext.visitor() ?? req.visitor ?? null;
    if (!visitor) {
      throw new VisitorError("UNAUTHENTICATED", "no visitor", 401);
    }
    return true;
  }
}
