import type { Visitors } from "../entity/visitor.entity.js";
import { listActiveVisitorsDirectory } from "../repo/visitor.repo.js";
import {
  countDocumentsByOwner,
  listDocumentsByOwner,
  type DocumentsOwnerFilters,
} from "../../documents/repo/document.repo";
import { toMyDocumentResponse } from "../../documents/mapper/my-document.mapper.js";
import type { MyDocumentsPageResponse } from "../../documents/response/my-document.response.js";
import { getDb } from "../../../infra/db/connection";
import { ensurePersonalDomain } from "../../domains/personal-domain.service";
import type { VisitorDirectoryEntry, VisitorPublic } from "../../../../shared/types/visitor";
import type { PageParams } from "../../../shared/request/page.params.js";
import {
  toVisitorDirectoryEntry,
  toVisitorPublic,
} from "../mapper/visitor.mapper.js";
import {
  findActiveVisitorByName,
  generateRecoveryCode,
  loginWithPassword,
  recoverVisitor,
  registerVisitor,
  setVisitorPassword,
  VisitorError,
} from "../service/visitor.service.js";

const MY_DOC_FILE_TYPES = new Set(["md", "html", "sheet"]);

/** 「我的文章」筛选条件（分页由入口校验后单独传入 PageParams）。 */
export type ListMyDocumentsQuery = {
  domainId?: string;
  creatorVisitorId?: string;
  fileType?: string;
};

function resolveOwnerFilters(query: ListMyDocumentsQuery): DocumentsOwnerFilters {
  const fileTypeRaw = query.fileType?.trim() || "";
  return {
    domainId: query.domainId?.trim() || null,
    creatorVisitorId: query.creatorVisitorId?.trim() || null,
    fileType: MY_DOC_FILE_TYPES.has(fileTypeRaw) ? fileTypeRaw : null,
  };
}

/** 注册：返回公开信息 + 明文 token（仅 cookie）+ 恢复码 */
export function registerVisitorAccount(
  visitorName: string,
  password?: string,
): { visitor: VisitorPublic; visitorToken: string; recoveryCode: string } {
  const result = registerVisitor(visitorName, password);
  return {
    visitor: result.visitor,
    visitorToken: result.visitorToken,
    recoveryCode: result.recoveryCode,
  };
}

/** 密码登录；区分未设密码 / 凭证错误 */
export function loginVisitorAccount(
  visitorName: string,
  password: string,
): { visitor: VisitorPublic; visitorToken: string } {
  const row = findActiveVisitorByName(visitorName);
  if (!row) {
    throw new VisitorError("INVALID_CREDENTIALS", "用户名或密码错误", 401);
  }
  if (!row.password_hash) {
    throw new VisitorError("NO_PASSWORD_SET", "该账号未设置密码，无法远程登录", 400);
  }
  const result = loginWithPassword(visitorName, password);
  if (!result) {
    throw new VisitorError("INVALID_CREDENTIALS", "用户名或密码错误", 401);
  }
  return { visitor: result.visitor, visitorToken: result.visitorToken };
}

/** 恢复码换身份；无效则 404 */
export function recoverVisitorAccount(
  recoveryCode: string,
): { visitor: VisitorPublic; visitorToken: string } {
  const result = recoverVisitor(recoveryCode);
  if (!result) {
    throw new VisitorError(
      "INVALID_RECOVERY_CODE",
      "recovery code is invalid or expired",
      404,
    );
  }
  return { visitor: result.visitor, visitorToken: result.visitorToken };
}

export function issueRecoveryCode(visitorId: string): { recoveryCode: string } {
  return { recoveryCode: generateRecoveryCode(visitorId) };
}

export function changeVisitorPassword(visitorId: string, password: string): { ok: true } {
  setVisitorPassword(visitorId, password);
  return { ok: true };
}

export function listVisitorDirectory(): { visitors: VisitorDirectoryEntry[] } {
  return {
    visitors: listActiveVisitorsDirectory().map(toVisitorDirectoryEntry),
  };
}

export function getCurrentVisitor(row: Visitors): { visitor: VisitorPublic } {
  ensurePersonalDomain(getDb(), row.visitor_id, row.visitor_name);
  return { visitor: toVisitorPublic(row) };
}

/**
 * 当前访客拥有的文档分页列表。
 * page 须已由入口校验（HTTP：ValidationPipe；Agent：resolvePageParams）。
 */
export function listCurrentVisitorDocuments(
  visitorId: string,
  query: ListMyDocumentsQuery,
  page: PageParams,
): MyDocumentsPageResponse {
  const filters = resolveOwnerFilters(query);
  const total = countDocumentsByOwner(visitorId, filters);
  const rows = listDocumentsByOwner(visitorId, filters, page);
  return {
    items: rows.map(toMyDocumentResponse),
    total,
    offset: page.offset,
    limit: page.limit,
  };
}
