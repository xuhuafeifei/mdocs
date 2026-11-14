import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { assertCanRead } from "../../modules/access/access.js";
import { VisitorContext } from "../context/visitor.context.js";

/** params/query 的 domainId + documentId → access.assertCanRead */
@Injectable()
export class CanReadDocumentGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const visitorId =
      VisitorContext.visitorId() ?? req.visitor?.visitor_id ?? null;
    const domainId = String(req.params.domainId ?? req.query.domainId ?? "").trim();
    const documentId = String(req.params.documentId ?? "").trim();
    assertCanRead(visitorId, domainId, documentId);
    return true;
  }
}
