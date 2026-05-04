import type Database from "better-sqlite3";
import { isDomainMember, type DomainRow } from "../db/repositories/domain.repo.js";
import { hasDocumentInviteInDomain } from "../db/repositories/document.repo.js";

/**
 * 访客能否进入「某域」的列表/树（单篇详情仍走文档权限）。无域邀请表；
 * `viaDocumentInvites` = 因该域内有文档邀请过我。
 */

export type DomainAccessKind = "none" | "full" | "viaDocumentInvites";

export interface DomainAccess {
  kind: DomainAccessKind;
}

export interface ResolveDomainAccessOptions {
  /** 批量列域时预先查好的「有文档邀请我的域」ID 集合，少打库。 */
  documentInviteDomainIds?: Set<string>;
}

/** 解析访客对该域的入口级别（列表、树、域内文档列表）。 */
export function resolveDomainAccess(
  db: Database.Database,
  domain: DomainRow | undefined,
  domainId: string,
  visitorId: string | null | undefined,
  options?: ResolveDomainAccessOptions,
): DomainAccess {
  if (!domain) return { kind: "none" };
  if (domain.permission === "public") return { kind: "full" };
  if (!visitorId) return { kind: "none" };

  // invite 表里只有 document_id，要知道域必须联 documents
  const hasDocInviteInDomain = options?.documentInviteDomainIds
    ? options.documentInviteDomainIds.has(domainId)
    : hasDocumentInviteInDomain(db, domainId, visitorId);

  if (domain.permission === "private") {
    if (domain.domain_id === visitorId) return { kind: "full" };
    if (domain.creator_visitor_id === visitorId) return { kind: "full" };
    if (hasDocInviteInDomain) return { kind: "viaDocumentInvites" };
    return { kind: "none" };
  }
  if (domain.permission === "restricted") {
    if (isDomainMember(db, domainId, visitorId)) return { kind: "full" };
    if (domain.creator_visitor_id === visitorId) return { kind: "full" };
    if (hasDocInviteInDomain) return { kind: "viaDocumentInvites" };
    return { kind: "none" };
  }
  return { kind: "none" };
}

/** 能否拉树 / 域下列表：只要不是 none 即可。 */
export function canEnterDomainTree(access: DomainAccess): boolean {
  return access.kind !== "none";
}
