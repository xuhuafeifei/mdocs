/**
 * access 对外门面：业务只传 id，不拼 Row / DomainAccessInfo。
 * 行级函数仍在 access-control.ts / domain-access.ts，供本文件与迁移期旧调用方使用。
 */
import { getDb } from "../../infra/db/connection.js";
import { findDocumentById } from "../../infra/db/repositories/document.repo.js";
import { findDomainById } from "../../infra/db/repositories/domain.repo.js";
import {
  DocumentError,
  canEditDocument,
  canReadDocument,
  makeDomainAccessInfo,
} from "./access-control.js";
import { canEnterDomainTree, resolveDomainAccess } from "./domain-access.js";

/** 能否进入该域（看树 / 列域文档的前门）。 */
export function canEnterDomain(visitorId: string | null, domainId: string): boolean {
  const db = getDb();
  const domain = findDomainById(db, domainId);
  const access = resolveDomainAccess(db, domain, domainId, visitorId);
  return canEnterDomainTree(access);
}

/** 能否读该文档。文档不存在或不属于 domainId → false。 */
export function canRead(
  visitorId: string | null,
  domainId: string,
  documentId: string,
): boolean {
  const ctx = loadDocInDomain(visitorId, domainId, documentId);
  if (!ctx) return false;
  return canReadDocument(ctx.row, visitorId, ctx.domainInfo);
}

/** 能否写该文档（现码 canEdit 语义）。 */
export function canWrite(
  visitorId: string | null,
  domainId: string,
  documentId: string,
): boolean {
  const ctx = loadDocInDomain(visitorId, domainId, documentId);
  if (!ctx) return false;
  return canEditDocument(ctx.row, visitorId, ctx.domainInfo);
}

export function assertCanEnterDomain(visitorId: string | null, domainId: string): void {
  if (!canEnterDomain(visitorId, domainId)) {
    throw new DocumentError("FORBIDDEN", "无权进入该域", 403);
  }
}

export function assertCanRead(
  visitorId: string | null,
  domainId: string,
  documentId: string,
): void {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row || row.domain_id !== domainId) {
    throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  }
  if (!canEnterDomain(visitorId, domainId)) {
    throw new DocumentError("FORBIDDEN", "无权进入该域", 403);
  }
  const domain = findDomainById(db, domainId);
  const domainInfo = makeDomainAccessInfo(
    db,
    domainId,
    visitorId,
    domain?.permission ?? "public",
  );
  if (!canReadDocument(row, visitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "无权读取此文档", 403);
  }
}

export function assertCanWrite(
  visitorId: string | null,
  domainId: string,
  documentId: string,
): void {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row || row.domain_id !== domainId) {
    throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  }
  if (!canEnterDomain(visitorId, domainId)) {
    throw new DocumentError("FORBIDDEN", "无权进入该域", 403);
  }
  const domain = findDomainById(db, domainId);
  const domainInfo = makeDomainAccessInfo(
    db,
    domainId,
    visitorId,
    domain?.permission ?? "public",
  );
  if (!canEditDocument(row, visitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "无权编辑此文档", 403);
  }
}

function loadDocInDomain(visitorId: string | null, domainId: string, documentId: string) {
  if (!canEnterDomain(visitorId, domainId)) return null;
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row || row.domain_id !== domainId) return null;
  const domain = findDomainById(db, domainId);
  const domainInfo = makeDomainAccessInfo(
    db,
    domainId,
    visitorId,
    domain?.permission ?? "public",
  );
  return { row, domainInfo };
}
