/**
 * documents 薄 service：本聚合对 `document.repo` 的唯一出口。
 * 业务代码（application / access / agent / tree / …）只依赖本文件，不直打 repo。
 * 对外不透传 Database；连接由 repo 内 getDb() 解析（单测 mock getDb）。
 */
import type { PageParams } from "../../../shared/request/page.params.js";
import type {
  DocumentInvites,
  Documents,
  DocumentsOwnerRow,
} from "../entity/document.entity.js";
import {
  countChildrenByParent as countChildrenByParentRepo,
  countDocumentsByDomain as countDocumentsByDomainRepo,
  countDocumentsByOwner as countDocumentsByOwnerRepo,
  deleteDocument as deleteDocumentRepo,
  deleteDocumentInvite as deleteDocumentInviteRepo,
  findChildrenByParent as findChildrenByParentRepo,
  findDocumentById as findDocumentByIdRepo,
  findDocumentByPath as findDocumentByPathRepo,
  findDocumentInvite as findDocumentInviteRepo,
  hasDocumentInviteInDomain as hasDocumentInviteInDomainRepo,
  insertDocument as insertDocumentRepo,
  insertDocumentInvite as insertDocumentInviteRepo,
  listDocumentInvites as listDocumentInvitesRepo,
  listDocumentsByDomain as listDocumentsByDomainRepo,
  listDocumentsByOwner as listDocumentsByOwnerRepo,
  listDocumentsByPathPrefix as listDocumentsByPathPrefixRepo,
  listDomainIdsWithDocumentInviteForVisitor as listDomainIdsWithDocumentInviteForVisitorRepo,
  updateDocumentContent as updateDocumentContentRepo,
  updateDocumentHeadCommit as updateDocumentHeadCommitRepo,
  updateDocumentLocation as updateDocumentLocationRepo,
  type DocumentsOwnerFilters,
} from "../repo/document.repo.js";

export type {
  DocumentInvites,
  Documents,
  DocumentsOwnerRow,
} from "../entity/document.entity.js";
export type { DocumentsOwnerFilters };

/** @deprecated 用 findDocumentById；access 存量别名 */
export function getDocumentById(documentId: string): Documents | undefined {
  return findDocumentById(documentId);
}

/** @deprecated 用 findDocumentInvite；access 存量别名 */
export function getDocumentInvite(
  documentId: string,
  visitorId: string,
): DocumentInvites | undefined {
  return findDocumentInvite(documentId, visitorId);
}

export function countDocumentsByDomain(domainId: string): number {
  return countDocumentsByDomainRepo(domainId);
}

export function listDocumentsByDomain(domainId: string): Documents[] {
  return listDocumentsByDomainRepo(domainId);
}

export function countDocumentsByOwner(
  visitorId: string,
  filters: DocumentsOwnerFilters,
): number {
  return countDocumentsByOwnerRepo(visitorId, filters);
}

export function listDocumentsByOwner(
  visitorId: string,
  filters: DocumentsOwnerFilters,
  page: PageParams,
): DocumentsOwnerRow[] {
  return listDocumentsByOwnerRepo(visitorId, filters, page);
}

export function findDocumentById(documentId: string): Documents | undefined {
  return findDocumentByIdRepo(documentId);
}

export function findDocumentByPath(
  domainId: string,
  relativePath: string,
): Documents | undefined {
  return findDocumentByPathRepo(domainId, relativePath);
}

export function insertDocument(input: Documents): void {
  insertDocumentRepo(input);
}

export function updateDocumentHeadCommit(input: Documents): void {
  updateDocumentHeadCommitRepo(input);
}

export function updateDocumentLocation(input: Documents): void {
  updateDocumentLocationRepo(input);
}

export function updateDocumentContent(input: Documents): void {
  updateDocumentContentRepo(input);
}

export function deleteDocument(documentId: string): void {
  deleteDocumentRepo(documentId);
}

export function listDocumentsByPathPrefix(
  domainId: string,
  pathPrefix: string,
): Documents[] {
  return listDocumentsByPathPrefixRepo(domainId, pathPrefix);
}

export function findDocumentInvite(
  documentId: string,
  visitorId: string,
): DocumentInvites | undefined {
  return findDocumentInviteRepo(documentId, visitorId);
}

export function insertDocumentInvite(input: DocumentInvites): void {
  insertDocumentInviteRepo(input);
}

export function deleteDocumentInvite(
  documentId: string,
  visitorId: string,
): void {
  deleteDocumentInviteRepo(documentId, visitorId);
}

export function listDocumentInvites(documentId: string): DocumentInvites[] {
  return listDocumentInvitesRepo(documentId);
}

export function listDomainIdsWithDocumentInviteForVisitor(
  visitorId: string,
): string[] {
  return listDomainIdsWithDocumentInviteForVisitorRepo(visitorId);
}

export function hasDocumentInviteInDomain(
  domainId: string,
  visitorId: string,
): boolean {
  return hasDocumentInviteInDomainRepo(domainId, visitorId);
}

export function findChildrenByParent(parentId: string): Documents[] {
  return findChildrenByParentRepo(parentId);
}

export function countChildrenByParent(parentId: string): number {
  return countChildrenByParentRepo(parentId);
}
