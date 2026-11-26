import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import {
  assertCanDeleteDocument,
  assertCanReadDocument,
  assertCanWriteDocument,
} from "../../modules/access/access.js";
import { assertDocumentOwner, DocumentError } from "../../modules/access/access-control.js";
import { VisitorContext } from "../context/visitor.context.js";

function documentIdFrom(req: Request): string {
  const documentId = String(req.params.documentId ?? "").trim();
  if (!documentId) {
    throw new DocumentError("BAD_REQUEST", "documentId is required", 400);
  }
  return documentId;
}

function visitorIdFrom(): string | null {
  return VisitorContext.visitorId();
}

/** params.documentId + 当前访客 → assertCanReadDocument */
@Injectable()
export class DocumentReadGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    assertCanReadDocument(visitorIdFrom(), documentIdFrom(req));
    return true;
  }
}

/** params.documentId + 当前访客 → assertCanWriteDocument */
@Injectable()
export class DocumentEditGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    assertCanWriteDocument(visitorIdFrom(), documentIdFrom(req));
    return true;
  }
}

/** params.documentId + 当前访客 → assertCanDeleteDocument */
@Injectable()
export class DocumentDeleteGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    assertCanDeleteDocument(visitorIdFrom(), documentIdFrom(req));
    return true;
  }
}

/** 仅文档 owner（invites 等） */
@Injectable()
export class DocumentOwnerGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const visitorId = visitorIdFrom();
    if (!visitorId) {
      throw new DocumentError("UNAUTHENTICATED", "no visitor", 401);
    }
    assertDocumentOwner(documentIdFrom(req), visitorId);
    return true;
  }
}
