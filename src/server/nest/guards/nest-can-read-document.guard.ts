import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { assertCanRead } from "../../modules/access/access.js";

/** params/query 的 domainId + documentId → access.assertCanRead */
@Injectable()
export class NestCanReadDocumentGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const visitorId = req.visitor?.visitor_id ?? null;
    const domainId = String(req.params.domainId ?? req.query.domainId ?? "").trim();
    const documentId = String(req.params.documentId ?? "").trim();
    assertCanRead(visitorId, domainId, documentId);
    return true;
  }
}
