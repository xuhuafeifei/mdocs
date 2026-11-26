/**
 * access 对外门面：业务只传 id，不拼 Row / DomainAccessInfo。
 * 行级 canReadDocument / canEditDocument 仅本文件组合用，业务勿直接调。
 */
import { isGraphFileType } from "../../../shared/file-types.js";
import {
  getDocumentById,
  hasDocumentInviteInDomain,
  listDomainIdsWithDocumentInviteForVisitor,
} from "../documents/service/document.service.js";
import {
  getDomainById,
  isDomainMember,
  listDomainIdsWhereVisitorIsMember,
  type Domains,
} from "../domains/service/domain.service.js";
import {
  DocumentError,
  canEditDocument,
  canReadDocument,
  makeDomainAccessInfo,
} from "./access-control.js";
import { canAccessGraph, type DomainAccess } from "./domain-access.js";

/**
 * 域入口规则（本文件私有，不对外）。
 * 调用方已备齐：域行、访客、是否有文档邀请、是否域成员 → 算出 none / full / viaDocumentInvites。
 */
function domainAccessFromFacts(
  domain: Domains | undefined,
  visitorId: string | null | undefined,
  hasDocInviteInDomain: boolean,
  isMember: boolean,
): DomainAccess {
  if (!domain) return { kind: "none" };
  if (domain.permission === "public") return { kind: "full" };
  if (!visitorId) return { kind: "none" };

  // private：域主、创建者、成员 → full；仅有文档邀请 → viaDocumentInvites
  if (domain.permission === "private") {
    if (domain.domain_id === visitorId) return { kind: "full" };
    if (domain.creator_visitor_id === visitorId) return { kind: "full" };
    if (isMember) return { kind: "full" };
    if (hasDocInviteInDomain) return { kind: "viaDocumentInvites" };
    return { kind: "none" };
  }

  // restricted：成员、创建者 → full；仅有文档邀请 → viaDocumentInvites
  if (domain.permission === "restricted") {
    if (isMember) return { kind: "full" };
    if (domain.creator_visitor_id === visitorId) return { kind: "full" };
    if (hasDocInviteInDomain) return { kind: "viaDocumentInvites" };
    return { kind: "none" };
  }

  return { kind: "none" };
}

/**
 * 能否进入该域（看树 / 列域文档的前门；含 viaDocumentInvites）。
 * 实现上委托 `canEnterDomains([domainId])`。
 */
export function canEnterDomain(visitorId: string | null, domainId: string): boolean {
  return canEnterDomains(visitorId, [domainId]).has(domainId);
}

/**
 * 批量进域门面（侧栏列域、agent list_domains、embedding 管理等）。
 *
 * 对一长串 domainId 滤出「访客能进哪些」：
 *   1. 整访客查一次「哪些域有文档邀请我」
 *   2. 针对这批 id 查一次「我是哪些的成员」
 *   3. 每个 id 用内部规则判定 kind
 *   4. 返回 kind !== none 的 domainId 集合
 *
 * 业务只传 visitorId + domainIds，不碰 Row / kind / 邀请集合。
 */
export function canEnterDomains(
  visitorId: string | null,
  domainIds: string[],
): Set<string> {
  const unique = Array.from(new Set(domainIds.map((id) => id.trim()).filter(Boolean)));
  const visible = new Set<string>();
  if (unique.length === 0) return visible;

  const inviteDomainIds = visitorId
    ? new Set(listDomainIdsWithDocumentInviteForVisitor(visitorId))
    : new Set<string>();
  const memberDomainIds = visitorId
    ? new Set(listDomainIdsWhereVisitorIsMember(visitorId, unique))
    : new Set<string>();

  for (const domainId of unique) {
    const domain = getDomainById(domainId);
    const access = domainAccessFromFacts(
      domain,
      visitorId,
      inviteDomainIds.has(domainId),
      memberDomainIds.has(domainId),
    );
    if (access.kind !== "none") visible.add(domainId);
  }
  return visible;
}

/**
 * 域协作身份（kind === full）。
 * viaDocumentInvites 不算——建目录、图谱等需此级。
 */
export function canFullyAccessDomain(
  visitorId: string | null,
  domainId: string,
): boolean {
  const domain = getDomainById(domainId);
  if (!domain) return false;
  if (domain.permission === "public") return true;
  if (!visitorId) return false;

  const hasInvite = hasDocumentInviteInDomain(domainId, visitorId);
  const member =
    domain.permission === "restricted" || domain.permission === "private"
      ? isDomainMember(domainId, visitorId)
      : false;
  return canAccessGraph(domainAccessFromFacts(domain, visitorId, hasInvite, member));
}

/** 图谱读/生成门禁：须 canFullyAccessDomain；viaDocumentInvites 一律 403。 */
export function assertGraphAccess(domainId: string, visitorId: string | null): void {
  if (canFullyAccessDomain(visitorId, domainId)) return;
  const domain = getDomainById(domainId);
  const message =
    domain?.permission === "private"
      ? "私有工作空间仅主人可访问图谱"
      : "请成为工作空间成员后再访问图谱";
  throw new DocumentError("GRAPH_FORBIDDEN", message, 403);
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
  const row = getDocumentById(documentId);
  if (!row || row.domain_id !== domainId) {
    throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  }
  if (!canEnterDomain(visitorId, domainId)) {
    throw new DocumentError("FORBIDDEN", "无权进入该域", 403);
  }
  const domain = getDomainById(domainId);
  const domainInfo = makeDomainAccessInfo(
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
  const row = getDocumentById(documentId);
  if (!row || row.domain_id !== domainId) {
    throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  }
  if (!canEnterDomain(visitorId, domainId)) {
    throw new DocumentError("FORBIDDEN", "无权进入该域", 403);
  }
  const domain = getDomainById(domainId);
  const domainInfo = makeDomainAccessInfo(
    domainId,
    visitorId,
    domain?.permission ?? "public",
  );
  if (!canEditDocument(row, visitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "无权编辑此文档", 403);
  }
}

/**
 * 仅有 documentId 时的读断言（Agent / Guard）。
 * 查文取 domainId 后走 assertCanRead；图谱缓存文件走 assertGraphAccess。
 */
export function assertCanReadDocument(
  visitorId: string | null,
  documentId: string,
): void {
  const row = getDocumentById(documentId);
  if (!row) {
    throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  }
  if (isGraphFileType(row.file_type)) {
    assertGraphAccess(row.domain_id, visitorId);
    return;
  }
  assertCanRead(visitorId, row.domain_id, documentId);
}

/**
 * 仅有 documentId 时的写断言（Agent / Guard）。
 * 查文取 domainId 后走 assertCanWrite。
 */
export function assertCanWriteDocument(
  visitorId: string | null,
  documentId: string,
): void {
  const row = getDocumentById(documentId);
  if (!row) {
    throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  }
  assertCanWrite(visitorId, row.domain_id, documentId);
}

/** 仅有 documentId 时的删除断言：始终仅创建者。 */
export function assertCanDeleteDocument(
  visitorId: string | null,
  documentId: string,
): void {
  const row = getDocumentById(documentId);
  if (!row) {
    throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  }
  if (row.owner_visitor_id !== visitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可删除此文档", 403);
  }
}

function loadDocInDomain(visitorId: string | null, domainId: string, documentId: string) {
  if (!canEnterDomain(visitorId, domainId)) return null;
  const row = getDocumentById(documentId);
  if (!row || row.domain_id !== domainId) return null;
  const domain = getDomainById(domainId);
  const domainInfo = makeDomainAccessInfo(
    domainId,
    visitorId,
    domain?.permission ?? "public",
  );
  return { row, domainInfo };
}
