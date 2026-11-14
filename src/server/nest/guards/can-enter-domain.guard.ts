import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { getConfig } from "../../infra/config/index.js";
import { assertCanEnterDomain } from "../../modules/access/access.js";
import { VisitorContext } from "../context/visitor.context.js";

/** 路由/query 上的 domainId（空则默认域）→ access.assertCanEnterDomain */
@Injectable()
export class CanEnterDomainGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const visitorId =
      VisitorContext.visitorId() ?? req.visitor?.visitor_id ?? null;
    const raw = String(req.params.domainId ?? req.query.domainId ?? "").trim();
    const domainId = raw || getConfig().defaultDomainId;
    assertCanEnterDomain(visitorId, domainId);
    return true;
  }
}
