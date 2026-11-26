/**
 * documents 薄 service：本聚合只读查询门面（含文档邀请）。
 * access 应经此层取文 / 邀请，不直打 repo。
 * 与根目录胖 `document.service.ts`（编排遗留）分开。
 * DB 藏在 repo（默认 getDb）；本层不接收、不传递 Database。
 */
import type {
  DocumentInvites,
  Documents,
} from "../entity/document.entity.js";
import {
  findDocumentById as findDocumentByIdRepo,
  findDocumentInvite as findDocumentInviteRepo,
  hasDocumentInviteInDomain as hasDocumentInviteInDomainRepo,
  listDocumentsByDomain as listDocumentsByDomainRepo,
  listDomainIdsWithDocumentInviteForVisitor as listDomainIdsWithDocumentInviteForVisitorRepo,
} from "../repo/document.repo.js";

export type { DocumentInvites, Documents } from "../entity/document.entity.js";

/** 按 id 查文档。 */
export function getDocumentById(documentId: string): Documents | undefined {
  return findDocumentByIdRepo(documentId);
}

/** 域下文档列表。 */
export function listDocumentsByDomain(domainId: string): Documents[] {
  return listDocumentsByDomainRepo(domainId);
}

/** 某访客对某文档的邀请行。 */
export function getDocumentInvite(
  documentId: string,
  visitorId: string,
): DocumentInvites | undefined {
  return findDocumentInviteRepo(documentId, visitorId);
}

/** 该域内是否存在对该访客的文档邀请。 */
export function hasDocumentInviteInDomain(
  domainId: string,
  visitorId: string,
): boolean {
  return hasDocumentInviteInDomainRepo(domainId, visitorId);
}

/** 访客因文档邀请可见的全部 domain_id（去重；供批量进域）。 */
export function listDomainIdsWithDocumentInviteForVisitor(
  visitorId: string,
): string[] {
  return listDomainIdsWithDocumentInviteForVisitorRepo(visitorId);
}
