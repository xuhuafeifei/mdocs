/**
 * 域入口控制
 *
 * 判断访客能否看到某个域、进入该域的目录树和文档列表。
 * 这是第一道门禁——进域后单篇文档的可见性还需走 access-control.ts 的文档权限检查。
 *
 * 返回值：
 *   "none"              → 不可见
 *   "full"              → 可进域列表/树
 *   "viaDocumentInvites" → 因域内有文档邀请过我而可见（private/restricted 域非成员通道）
 */

import type Database from "better-sqlite3";
import { isDomainMember, type DomainRow } from "../db/repositories/domain.repo.js";
import { hasDocumentInviteInDomain } from "../db/repositories/document.repo.js";

export type DomainAccessKind = "none" | "full" | "viaDocumentInvites";

export interface DomainAccess {
  kind: DomainAccessKind;
}

export interface ResolveDomainAccessOptions {
  /** 批量列域时预先查好的"有文档邀请我的域"ID 集合，省得逐域查库。 */
  documentInviteDomainIds?: Set<string>;
}

/** 解析访客对该域的入口级别 */
export function resolveDomainAccess(
  db: Database.Database,
  domain: DomainRow | undefined,
  domainId: string,
  visitorId: string | null | undefined,
  options?: ResolveDomainAccessOptions,
): DomainAccess {
  if (!domain) return { kind: "none" };

  // public 域：任何人可进
  if (domain.permission === "public") return { kind: "full" };
  if (!visitorId) return { kind: "none" };

  // 查一下该访客在域内是否有文档邀请
  const hasDocInviteInDomain = options?.documentInviteDomainIds
    ? options.documentInviteDomainIds.has(domainId)
    : hasDocumentInviteInDomain(db, domainId, visitorId);

  // private 域：仅域主（domain_id === visitorId）、创建者、或有文档邀请者可见
  if (domain.permission === "private") {
    if (domain.domain_id === visitorId) return { kind: "full" };
    if (domain.creator_visitor_id === visitorId) return { kind: "full" };
    if (hasDocInviteInDomain) return { kind: "viaDocumentInvites" };
    return { kind: "none" };
  }

  // restricted 域：仅域成员、创建者、或有文档邀请者可见
  if (domain.permission === "restricted") {
    if (isDomainMember(db, domainId, visitorId)) return { kind: "full" };
    if (domain.creator_visitor_id === visitorId) return { kind: "full" };
    if (hasDocInviteInDomain) return { kind: "viaDocumentInvites" };
    return { kind: "none" };
  }

  return { kind: "none" };
}

/** 能否拉目录树 / 域下列表：kind 不是 "none" 即可 */
export function canEnterDomainTree(access: DomainAccess): boolean {
  return access.kind !== "none";
}

/**
 * 能否读/生成该域图谱。
 * 只认协作身份 full；viaDocumentInvites（只借单篇正文）不授图谱。
 * 见 `.mdocs-docs/requirements/knowledge-graph/设计契约-graph-access.md`。
 */
export function canAccessGraph(access: DomainAccess): boolean {
  return access.kind === "full";
}
