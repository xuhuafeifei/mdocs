/**
 * 统一访问控制模块
 *
 * == 设计原则 ==
 * - 五级权限 + invite 叠加，域类型约束文档档位
 * - 所有读/写/删的权限判断都收拢在此，不分散到各服务和路由
 * - canReadDocument / canEditDocument 需调用方提供域上下文（域类型 + 成员身份），
 *   避免在批量操作中反复查库
 * - assertDocumentAccess 自带 DB 查询，适合路由中间件单篇鉴权
 *
 * == 鉴权顺序 ==
 *   1. 创建者（owner）→ 直接放行
 *   2. public 域 → 走 3/4 档语义（任何人可读/可写）
 *   3. restricted 域 → 域成员走 1/2 档；非成员靠 invite
 *   4. private 域 → 按五档实际语义 + invite
 *   5. invite 叠加（与域成员互斥，见 addDocumentInvite）
 */

import { getDb } from "../db/connection.js";
import { findDocumentById, findDocumentInvite } from "../db/repositories/document.repo.js";
import { findDomainById, isDomainMember as checkDomainMember } from "../db/repositories/domain.repo.js";
import type { DocumentRow } from "../db/repositories/document.repo.js";
// ============================================================
//  通用错误类型
// ============================================================

export class DocumentError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ============================================================
//  五级权限
// ============================================================

export const Permission = {
  /** 仅创建者读+写 */
  PRIVATE: 0,
  /** 域成员可读，仅创建者可写 */
  DOMAIN_READ: 1,
  /** 域成员可读+写 */
  DOMAIN_WRITE: 2,
  /** 任何人可读，仅创建者可写 */
  PUBLIC_READ: 3,
  /** 任何人可读+写 */
  PUBLIC_WRITE: 4,
} as const;

// ============================================================
//  域类型 × 允许的文档权限档位
// ============================================================

const DOMAIN_ALLOWED_PERMISSIONS: Record<string, readonly number[]> = {
  public: [Permission.PUBLIC_READ, Permission.PUBLIC_WRITE],
  restricted: [Permission.DOMAIN_READ, Permission.DOMAIN_WRITE],
  private: [
    Permission.PRIVATE,
    Permission.DOMAIN_READ,
    Permission.DOMAIN_WRITE,
    Permission.PUBLIC_READ,
    Permission.PUBLIC_WRITE,
  ],
};

/** 检查某域类型是否允许该文档权限值 */
export function validateDomainPermission(domainPermission: string, docPermission: number): boolean {
  const allowed = DOMAIN_ALLOWED_PERMISSIONS[domainPermission];
  return allowed ? allowed.includes(docPermission) : false;
}

// ============================================================
//  域上下文（调用方提供，批量场景可预查一次）
// ============================================================

export interface DomainAccessInfo {
  /** 域类型：public | restricted | private */
  domainPermission: string;
  /** 当前访客是否是该域成员 */
  isDomainMember: boolean;
}

/**
 * 获取域权限上下文（供 bookmarks 等模块使用）。
 */
export function getDomainInfo(db: any, domainId: string, visitorId: string | null): DomainAccessInfo {
  const domain = findDomainById(db, domainId);
  const domainPermission = domain?.permission ?? "public";
  const isDomainMember = !!(visitorId && domain && checkDomainMember(db, domain.domain_id, visitorId));
  return { domainPermission, isDomainMember };
}

// ============================================================
//  读权限
// ============================================================

/**
 * 判断某访客是否有权读取该文档。
 * 注意：此函数不检查域入口（domain entry）—— 调用方应先用 canEnterDomainTree 过滤。
 */
export function canReadDocument(
  row: DocumentRow,
  visitorId: string | null | undefined,
  domainInfo: DomainAccessInfo,
): boolean {
  // 1. 创建者永远可读
  if (row.owner_visitor_id === visitorId) return true;

  // 2. 未登录：只能读 public_read / public_write（3/4 档）
  if (!visitorId) return row.permission >= Permission.PUBLIC_READ;

  // 3. 根据域上下文 + 权限值判断
  if (domainInfo.domainPermission === "public") {
    // public 域仅 3/4 档，两者都是"任何人可读"
    return row.permission >= Permission.PUBLIC_READ;
  }

  if (domainInfo.domainPermission === "restricted") {
    // restricted 域仅 1/2 档
    if (row.permission >= Permission.DOMAIN_READ) {
      if (domainInfo.isDomainMember) return true;
    }
    // 非成员靠 invite
    return !!findDocumentInvite(getDb(), row.document_id, visitorId);
  }

  // private 域：按五档实际语义
  if (row.permission === Permission.PRIVATE) {
    // 仅创建者（已在第 1 步判断过），其他人靠 invite
    return !!findDocumentInvite(getDb(), row.document_id, visitorId);
  }
  if (row.permission <= Permission.DOMAIN_WRITE) {
    // domain_read / domain_write：private 域只有创建者一名成员
    // 不是创建者，且不是成员 → 靠 invite
    return !!findDocumentInvite(getDb(), row.document_id, visitorId);
  }
  // public_read / public_write：任何人可读
  return true;
}

// ============================================================
//  写权限
// ============================================================

/**
 * 判断某访客是否有权编辑该文档。
 */
export function canEditDocument(
  row: DocumentRow,
  visitorId: string | null | undefined,
  domainInfo: DomainAccessInfo,
): boolean {
  // 1. 创建者永远可写
  if (row.owner_visitor_id === visitorId) return true;

  // 2. 未登录：只能写 public_write（4 档）
  if (!visitorId) return row.permission === Permission.PUBLIC_WRITE;

  // 3. 根据域上下文 + 权限值判断
  if (domainInfo.domainPermission === "public") {
    // public 域仅 3/4 档，仅 4 (public_write) 允许任何人写
    return row.permission === Permission.PUBLIC_WRITE;
  }

  if (domainInfo.domainPermission === "restricted") {
    // restricted 域仅 1/2 档，仅 2 (domain_write) 允许域成员写
    if (row.permission === Permission.DOMAIN_WRITE && domainInfo.isDomainMember) return true;
    // 非成员靠 invite
    const invite = findDocumentInvite(getDb(), row.document_id, visitorId);
    return invite?.permission === "edit";
  }

  // private 域：按五档实际语义
  if (row.permission === Permission.PRIVATE) {
    // 仅创建者可写
    return false;
  }
  if (row.permission === Permission.DOMAIN_READ) {
    // domain_read：仅创建者可写（已在第 1 步排除了）
    return false;
  }
  if (row.permission === Permission.DOMAIN_WRITE) {
    // domain_write：域成员可写，但 private 域只有创建者一名成员
    return false;
  }
  if (row.permission === Permission.PUBLIC_READ) {
    // public_read：仅创建者可写
    return false;
  }
  // public_write：任何人可写
  return true;
}

// ============================================================
//  统一鉴权入口（自带 DB 查询，适合路由中间件）
// ============================================================

/**
 * 全量鉴权：查文档 → 查域 → 判断读写删权限。
 * 抛 DocumentError（404/403），由 error-handling 中间件或路由 catch 处理。
 */
export function assertDocumentAccess(
  documentId: string,
  visitorId: string | null,
  action: "read" | "edit" | "delete",
): void {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row) {
    throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  }

  // 删除：始终仅创建者
  if (action === "delete") {
    if (row.owner_visitor_id !== visitorId) {
      throw new DocumentError("FORBIDDEN", "仅创建者可删除此文档", 403);
    }
    return;
  }

  // 读/写：需要域上下文
  const domain = findDomainById(db, row.domain_id);
  const domainPermission = domain?.permission ?? "public";
  const isMember = !!(visitorId && domain && checkDomainMember(db, domain.domain_id, visitorId));
  const domainInfo: DomainAccessInfo = { domainPermission, isDomainMember: isMember };

  if (action === "read" && !canReadDocument(row, visitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "无权读取此文档", 403);
  }
  if (action === "edit" && !canEditDocument(row, visitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "无权编辑此文档", 403);
  }
}
