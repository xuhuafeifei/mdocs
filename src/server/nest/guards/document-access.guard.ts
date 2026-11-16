import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import {
  assertDocumentAccess,
  assertDocumentOwner,
  DocumentError,
} from "../../modules/access/access-control.js";
import { VisitorContext } from "../context/visitor.context.js";

function documentIdFrom(req: Request): string {
  const documentId = String(req.params.documentId ?? "").trim();
  if (!documentId) {
    throw new DocumentError("BAD_REQUEST", "documentId is required", 400);
  }
  return documentId;
}

function visitorIdFrom(req: Request): string | null {
  return VisitorContext.visitorId() ?? req.visitor?.visitor_id ?? null;
}

/** params.documentId + 当前访客 → assertDocumentAccess(read) */
@Injectable()
export class DocumentReadGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    assertDocumentAccess(documentIdFrom(req), visitorIdFrom(req), "read");
    return true;
  }
}

/** params.documentId + 当前访客 → assertDocumentAccess(edit) */
@Injectable()
export class DocumentEditGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    assertDocumentAccess(documentIdFrom(req), visitorIdFrom(req), "edit");
    return true;
  }
}

/** params.documentId + 当前访客 → assertDocumentAccess(delete) */
@Injectable()
export class DocumentDeleteGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    assertDocumentAccess(documentIdFrom(req), visitorIdFrom(req), "delete");
    return true;
  }
}

/** 仅文档 owner（invites 等） */
@Injectable()
export class DocumentOwnerGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const visitorId = visitorIdFrom(req);
    if (!visitorId) {
      throw new DocumentError("UNAUTHENTICATED", "no visitor", 401);
    }
    assertDocumentOwner(documentIdFrom(req), visitorId);
    return true;
  }
}
