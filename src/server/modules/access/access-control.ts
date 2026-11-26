/**
 * 统一访问控制模块（行级实现）
 *
 * 业务鉴权请用 access.ts 的 id 门面。本文件的 canReadDocument / canEditDocument
 * 仅供门面组合与权限单测，勿在 application / agent / Guard 直接调用。
 *
 * == 鉴权顺序 ==
 *   1. 创建者（owner）→ 直接放行
 *   2. public 域 → 走 3/4 档语义（任何人可读/可写）
 *   3. restricted 域 → 域成员走 1/2 档；非成员靠 invite
 *   4. private 域 → 按五档实际语义 + invite
 *   5. invite 叠加（与域成员互斥，见 addDocumentInvite）
 *   6. Invite 管理能力：仅限文档创建者（invites HTTP 路由，见 assertDocumentOwner）
 */

import {
  getDocumentById,
  getDocumentInvite,
  type Documents,
} from "../documents/service/document.service.js";
import {
  getDomainById,
  getDomainMemberRole,
} from "../domains/service/domain.service.js";
// ============================================================
//  通用错误类型
// ============================================================

export class DocumentError extends Error {
  status: number;
  code: string;
  /** 可选附加信息（如 VERSION_CONFLICT 时返回远端 head 与正文）。 */
  details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// ============================================================
//  五级权限
// ============================================================

export const Permission = {
  /** 仅创建者读+写 */
  PRIVATE: 0,
  /** 域成员可读；write 角色成员亦可写（见 canEditDocument） */
  DOMAIN_READ: 1,
  /** 域成员可读；write 角色成员可写（与 DOMAIN_READ 对成员写权同义，档位保留兼容） */
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
  /** 成员 role=write 时为 true；只读成员 / 非成员为 false */
  domainMemberCanWrite: boolean;
}

/**
 * 组装域访问上下文（含成员读写角色）。
 */
export function makeDomainAccessInfo(
  domainId: string,
  visitorId: string | null | undefined,
  domainPermission: string,
): DomainAccessInfo {
  if (!visitorId) {
    return { domainPermission, isDomainMember: false, domainMemberCanWrite: false };
  }
  const role = getDomainMemberRole(domainId, visitorId);
  return {
    domainPermission,
    isDomainMember: role !== null,
    domainMemberCanWrite: role === "write",
  };
}

/**
 * 获取域权限上下文（供 bookmarks 等模块使用）。
 */
export function getDomainInfo(domainId: string, visitorId: string | null): DomainAccessInfo {
  const domain = getDomainById(domainId);
  const domainPermission = domain?.permission ?? "public";
  if (!visitorId || !domain) {
    return { domainPermission, isDomainMember: false, domainMemberCanWrite: false };
  }
  return makeDomainAccessInfo(domain.domain_id, visitorId, domainPermission);
}

// ============================================================
//  读权限
// ============================================================

/**
 * 行级读权限（不查域入口）。仅 access 门面与单测使用；业务用 `canRead`。
 */
export function canReadDocument(
  row: Documents,
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
    return !!getDocumentInvite(row.document_id, visitorId);
  }

  // private 域：按五档实际语义
  if (row.permission === Permission.PRIVATE) {
    // 仅创建者（已在第 1 步判断过），其他人靠 invite
    return !!getDocumentInvite(row.document_id, visitorId);
  }
  if (row.permission <= Permission.DOMAIN_WRITE) {
    // domain_read / domain_write：private 域只有创建者一名成员
    // 不是创建者，且不是成员 → 靠 invite
    return !!getDocumentInvite(row.document_id, visitorId);
  }
  // public_read / public_write：任何人可读
  return true;
}

// ============================================================
//  写权限
// ============================================================

/**
 * 行级写权限。仅 access 门面与单测使用；业务用 `canWrite`。
 */
export function canEditDocument(
  row: Documents,
  visitorId: string | null | undefined,
  domainInfo: DomainAccessInfo,
): boolean {
  // 1. 创建者永远可写
  if (row.owner_visitor_id === visitorId) return true;

  // 2. 未登录：只能写 public_write（4 档）
  if (!visitorId) return row.permission === Permission.PUBLIC_WRITE;

  // 3. 根据域上下文 + 权限值判断
  if (domainInfo.domainPermission === "public") {
    // public 域仅 3/4 档：
    // - 4 (public_write) 任何人可写
    // - 3 (public_read) 仅创建者可写（已在前面处理）或靠 invite(edit)
    if (row.permission === Permission.PUBLIC_WRITE) return true;
    const invite = getDocumentInvite(row.document_id, visitorId);
    return invite?.permission === "edit";
  }

  if (domainInfo.domainPermission === "restricted") {
    // restricted：成员 write 可编 domain_read/domain_write（默认新建是 domain_read）；非成员靠 invite
    if (
      domainInfo.domainMemberCanWrite &&
      (row.permission === Permission.DOMAIN_READ || row.permission === Permission.DOMAIN_WRITE)
    ) {
      return true;
    }
    const invite = getDocumentInvite(row.document_id, visitorId);
    return invite?.permission === "edit";
  }

  // private 域：按五档实际语义
  if (row.permission === Permission.PRIVATE) {
    // 仅创建者可写，或靠 invite
    const invite = getDocumentInvite(row.document_id, visitorId);
    return invite?.permission === "edit";
  }
  if (row.permission === Permission.DOMAIN_READ || row.permission === Permission.DOMAIN_WRITE) {
    // 成员 write 可写；否则靠 invite
    if (domainInfo.domainMemberCanWrite) return true;
    const invite = getDocumentInvite(row.document_id, visitorId);
    return invite?.permission === "edit";
  }
  if (row.permission === Permission.PUBLIC_READ) {
    // public_read：仅创建者可写，或靠 invite
    const invite = getDocumentInvite(row.document_id, visitorId);
    return invite?.permission === "edit";
  }
  // public_write：任何人可写
  return true;
}

/**
 * 文档邀请：仅创建者可列出 / 新增 / 移除邀请（与被邀请者的 edit 权限区分）。
 */
export function assertDocumentOwner(documentId: string, visitorId: string | null): void {
  if (!visitorId) {
    throw new DocumentError("UNAUTHENTICATED", "no visitor", 401);
  }
  const row = getDocumentById(documentId);
  if (!row) {
    throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  }
  if (row.owner_visitor_id !== visitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可管理邀请", 403);
  }
}
