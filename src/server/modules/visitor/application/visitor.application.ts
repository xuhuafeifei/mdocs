import type { VisitorRow } from "../../../infra/db/repositories/visitor.repo";
import { listActiveVisitorsDirectory } from "../../../infra/db/repositories/visitor.repo";
import {
  listDocumentsByVisitor,
  type MyDocumentsQuery,
  type PaginatedDocuments,
} from "../../../infra/db/repositories/document.repo";
import { getDb } from "../../../infra/db/connection";
import { ensurePersonalDomain } from "../../domains/personal-domain.service";
import type { VisitorDirectoryEntry, VisitorPublic } from "../../../../shared/types/visitor";
import {
  findActiveVisitorByName,
  generateRecoveryCode,
  loginWithPassword,
  recoverVisitor,
  registerVisitor,
  setVisitorPassword,
  toPublic,
  VisitorError,
} from "../visitor.service";

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
  const rows = listActiveVisitorsDirectory(getDb());
  return {
    visitors: rows.map((r) => ({
      visitorId: r.visitor_id,
      visitorName: r.visitor_name,
    })),
  };
}

export function getCurrentVisitor(row: VisitorRow): { visitor: VisitorPublic } {
  ensurePersonalDomain(getDb(), row.visitor_id, row.visitor_name);
  return { visitor: toPublic(row) };
}

export function listCurrentVisitorDocuments(
  visitorId: string,
  query: MyDocumentsQuery,
): PaginatedDocuments {
  return listDocumentsByVisitor(getDb(), visitorId, query);
}
