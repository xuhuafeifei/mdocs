/**
 * documents / document_invites 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 * 入参/返回均为表实体或查询 Row（缺列传 null）；不做 HTTP 映射与分页加工。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { PageParams } from "../../../shared/request/page.params.js";
import type {
  DocumentInvites,
  Documents,
  DocumentsOwnerRow,
} from "../entity/document.entity.js";

export type {
  DocumentInvites,
  Documents,
  DocumentsOwnerRow,
} from "../entity/document.entity.js";

/** 按 owner 列表的过滤条件（调用方已规范化；null = 不筛）。 */
export type DocumentsOwnerFilters = {
  domainId: string | null;
  creatorVisitorId: string | null;
  fileType: string | null;
};

type OwnerFilterArgs = [
  string,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
];

const OWNER_LIST_WHERE = `WHERE d.owner_visitor_id = ?
    AND (? IS NULL OR d.domain_id = ?)
    AND (? IS NULL OR d.owner_visitor_id = ?)
    AND (? IS NULL OR d.file_type = ?)`;

function ownerFilterArgs(
  visitorId: string,
  filters: DocumentsOwnerFilters,
): OwnerFilterArgs {
  return [
    visitorId,
    filters.domainId,
    filters.domainId,
    filters.creatorVisitorId,
    filters.creatorVisitorId,
    filters.fileType,
    filters.fileType,
  ];
}

export function countDocumentsByDomain(
  domainId: string,
  db?: Database.Database,
): number {
  const row = resolveDb(db).prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM documents WHERE domain_id = ?`,
    )
    .get(domainId);
  return row?.c ?? 0;
}

/**
 * 列出指定域下的所有文档，按相对路径升序排列。
 */
export function listDocumentsByDomain(
  domainId: string,
  db?: Database.Database,
): Documents[] {
  return resolveDb(db).prepare<string, Documents>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, head_commit_id, created_at, updated_at, permission,
              file_type, parent_id, is_dirty
       FROM documents WHERE domain_id = ? ORDER BY relative_path`,
    )
    .all(domainId);
}

/** 当前访客作为 owner 的文档总数（可选域/创建者/类型过滤）。 */
export function countDocumentsByOwner(
  visitorId: string,
  filters: DocumentsOwnerFilters,
  db?: Database.Database,
): number {
  const args = ownerFilterArgs(visitorId, filters);
  const row = resolveDb(db)
    .prepare<OwnerFilterArgs, { c: number }>(
      `SELECT COUNT(*) as c FROM documents d ${OWNER_LIST_WHERE}`,
    )
    .get(...args);
  return row?.c ?? 0;
}

/**
 * 当前访客作为 owner 的文档分页列表（JOIN 创建者名）。
 * page 须已由入口校验（ValidationPipe / resolvePageParams）。
 */
export function listDocumentsByOwner(
  visitorId: string,
  filters: DocumentsOwnerFilters,
  page: PageParams,
  db?: Database.Database,
): DocumentsOwnerRow[] {
  const args = ownerFilterArgs(visitorId, filters);
  return resolveDb(db)
    .prepare<[...OwnerFilterArgs, number, number], DocumentsOwnerRow>(
      `SELECT d.document_id, d.domain_id, d.relative_path, d.display_name, d.created_at, d.updated_at,
              d.permission, d.file_type, d.owner_visitor_id, v.visitor_name AS creator_name
       FROM documents d
       LEFT JOIN visitors v ON v.visitor_id = d.owner_visitor_id
       ${OWNER_LIST_WHERE}
       ORDER BY d.updated_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, page.limit, page.offset);
}

/**
 * 根据文档 ID 查找单篇文档。
 *
 * @param db - better-sqlite3 数据库实例
 * @param documentId - 文档唯一标识
 * @returns 匹配的数据库行；未找到则返回 undefined
 */
export function findDocumentById(
  documentId: string,
  db?: Database.Database,
): Documents | undefined {
  return resolveDb(db).prepare<string, Documents>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, head_commit_id, created_at, updated_at, permission,
              file_type, parent_id, is_dirty
       FROM documents WHERE document_id = ?`,
    )
    .get(documentId);
}

/**
 * 根据域和相对路径查找单篇文档。
 *
 * 注意：relative_path 现在是 (domain_id, relative_path) 联合唯一，
 * 因此查询必须包含 domainId。
 *
 * @param db - better-sqlite3 数据库实例
 * @param domainId - 域 ID
 * @param relativePath - 文档的相对路径
 * @returns 匹配的数据库行；未找到则返回 undefined
 */
export function findDocumentByPath(
  domainId: string,
  relativePath: string,
  db?: Database.Database,
): Documents | undefined {
  return resolveDb(db).prepare<[string, string], Documents>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, head_commit_id, created_at, updated_at, permission,
              file_type, parent_id, is_dirty
       FROM documents WHERE domain_id = ? AND relative_path = ?`,
    )
    .get(domainId, relativePath);
}

/**
 * 插入一篇新文档到数据库。
 *
 * @param db - better-sqlite3 数据库实例
 * @param input - 包含所有必填字段的插入参数
 */
export function insertDocument(
  input: Documents,
  db?: Database.Database,
): void {
  resolveDb(db).prepare(
    `INSERT INTO documents
     (document_id, domain_id, relative_path, display_name, owner_visitor_id,
      created_by, updated_by, content_hash, head_commit_id, created_at, updated_at, permission,
      file_type, parent_id, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.document_id,
    input.domain_id,
    input.relative_path,
    input.display_name,
    input.owner_visitor_id,
    input.created_by,
    input.updated_by,
    input.content_hash,
    input.head_commit_id ?? null,
    input.created_at,
    input.updated_at,
    input.permission,
    input.file_type ?? "md",
    input.parent_id ?? null,
    input.is_dirty,
  );
}

/** 更新 documents.head_commit_id，指向当前对外生效的最新提交。 */
export function updateDocumentHeadCommit(
  input: Documents,
  db?: Database.Database,
): void {
  resolveDb(db).prepare(
    `UPDATE documents
     SET head_commit_id = ?, updated_by = ?, updated_at = ?
     WHERE document_id = ?`,
  ).run(input.head_commit_id, input.updated_by, input.updated_at, input.document_id);
}

/** 更新文档在树中的位置与磁盘相对路径（移动文档时使用）。 */
export function updateDocumentLocation(
  input: Documents,
  db?: Database.Database,
): void {
  resolveDb(db).prepare(
    `UPDATE documents
     SET parent_id = ?, relative_path = ?, updated_by = ?, updated_at = ?
     WHERE document_id = ?`,
  ).run(
    input.parent_id,
    input.relative_path,
    input.updated_by,
    input.updated_at,
    input.document_id,
  );
}

/**
 * 更新文档内容与元数据。
 *
 * 分支逻辑：
 * - 如果 input.permission 有值，则同时更新 permission 字段。
 * - 如果没传 permission，则只更新 display_name、content_hash、updated_by、updated_at。
 *
 * @param db - better-sqlite3 数据库实例
 * @param input - 包含要更新字段的参数对象
 */
export function updateDocumentContent(
  input: Documents,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `UPDATE documents
       SET display_name = ?, content_hash = ?, updated_by = ?, updated_at = ?, permission = ?
       WHERE document_id = ?`,
    )
    .run(
      input.display_name,
      input.content_hash,
      input.updated_by,
      input.updated_at,
      input.permission,
      input.document_id,
    );
}

/**
 * 根据文档 ID 删除文档记录。
 *
 * 注意：此函数只删数据库记录，不删磁盘文件；
 * 磁盘文件的删除由调用方（如 removeDocument 服务函数）负责。
 *
 * @param db - better-sqlite3 数据库实例
 * @param documentId - 要删除的文档 ID
 */
export function deleteDocument(
  documentId: string,
  db?: Database.Database,
): void {
  resolveDb(db).prepare(`DELETE FROM documents WHERE document_id = ?`).run(documentId);
}

/**
 * 查询指定域下某路径前缀的所有文档（递归查找目录下所有内容）。
 * 用于目录删除时找出所有需要删除的文档。
 *
 * @param db - better-sqlite3 数据库实例
 * @param domainId - 域 ID
 * @param pathPrefix - 路径前缀（如 "folder/subfolder/"）
 * @returns 匹配的文档行数组
 */
export function listDocumentsByPathPrefix(
  domainId: string,
  pathPrefix: string,
  db?: Database.Database,
): Documents[] {
  return resolveDb(db).prepare<[string, string], Documents>(
      `SELECT * FROM documents WHERE domain_id = ? AND relative_path LIKE ?`,
    )
    .all(domainId, `${pathPrefix}%`);
}

/**
 * 查询某访客对指定文档的邀请记录。
 *
 * @param db - better-sqlite3 数据库实例
 * @param documentId - 文档 ID
 * @param visitorId - 访客 ID
 * @returns 邀请记录行；未找到则返回 undefined
 */
export function findDocumentInvite(
  documentId: string,
  visitorId: string,
  db?: Database.Database,
): DocumentInvites | undefined {
  return resolveDb(db).prepare<[string, string], DocumentInvites>(
      `SELECT document_id, visitor_id, permission FROM document_invites WHERE document_id = ? AND visitor_id = ?`,
    )
    .get(documentId, visitorId);
}

/**
 * 插入或更新文档邀请记录。
 *
 * 使用 SQLite 的 ON CONFLICT ... DO UPDATE：
 * 如果 (document_id, visitor_id) 组合已存在，则覆盖 permission 字段；
 * 不存在则插入新记录。
 */
export function insertDocumentInvite(
  input: DocumentInvites,
  db?: Database.Database,
): void {
  resolveDb(db).prepare(
    `INSERT INTO document_invites (document_id, visitor_id, permission) VALUES (?, ?, ?)
     ON CONFLICT(document_id, visitor_id) DO UPDATE SET permission = excluded.permission`,
  ).run(input.document_id, input.visitor_id, input.permission);
}

/**
 * 删除指定文档对指定访客的邀请记录。
 *
 * @param db - better-sqlite3 数据库实例
 * @param documentId - 文档 ID
 * @param visitorId - 访客 ID
 */
export function deleteDocumentInvite(
  documentId: string,
  visitorId: string,
  db?: Database.Database,
): void {
  resolveDb(db).prepare(`DELETE FROM document_invites WHERE document_id = ? AND visitor_id = ?`).run(documentId, visitorId);
}

/**
 * 列出指定文档的所有邀请记录。
 *
 * @param db - better-sqlite3 数据库实例
 * @param documentId - 文档 ID
 * @returns 该文档的全部邀请记录数组
 */
export function listDocumentInvites(
  documentId: string,
  db?: Database.Database,
): DocumentInvites[] {
  return resolveDb(db).prepare<string, DocumentInvites>(
      `SELECT document_id, visitor_id, permission FROM document_invites WHERE document_id = ?`,
    )
    .all(documentId);
}

/**
 * 查的是什么：当前访客在「文档邀请」里涉及到的所有域 ID（同一域多篇邀请只算一次）。
 * 怎么实现：`document_invites` 按 `document_id` 关联 `documents`，用 `visitor_id = ?` 过滤，`DISTINCT` 取 `domain_id`。
 *
 * 用途：批量列域时，可预先查出所有「因文档邀请而可见」的域ID集合，
 * 避免在 canEnterDomains 中逐域查库。
 *
 * @param db - better-sqlite3 数据库实例
 * @param visitorId - 当前访客 ID
 * @returns 该访客被邀请过的所有文档所属域的 ID 数组（去重）
 */
export function listDomainIdsWithDocumentInviteForVisitor(
  visitorId: string,
  db?: Database.Database,
): string[] {
  const rows = resolveDb(db).prepare<string, { domain_id: string }>(
      `SELECT DISTINCT d.domain_id AS domain_id
       FROM document_invites di
       INNER JOIN documents d ON d.document_id = di.document_id
       WHERE di.visitor_id = ?`,
    )
    .all(visitorId);
  // 把对象数组展平为字符串数组
  return rows.map((r) => r.domain_id);
}

/**
 * 查的是什么：给定域里，是否存在至少一篇文档对当前访客有邀请记录。
 * 怎么实现：同样的 invite 联 documents，加上 `domain_id = ?` 与 `visitor_id = ?`，用 `EXISTS` 只判断有无一行。
 *
 * 用途：判断 restricted/private 域是否因文档邀请而对访客可见。
 *
 * @param db - better-sqlite3 数据库实例
 * @param domainId - 目标域 ID
 * @param visitorId - 当前访客 ID
 * @returns true 表示该域里至少有一篇文档邀请了这个访客
 */
export function hasDocumentInviteInDomain(
  domainId: string,
  visitorId: string,
  db?: Database.Database,
): boolean {
  const row = resolveDb(db).prepare<[string, string], { ok: number }>(
      `SELECT EXISTS (
         SELECT 1 FROM document_invites di
         INNER JOIN documents d ON d.document_id = di.document_id
         WHERE d.domain_id = ? AND di.visitor_id = ?
       ) AS ok`,
    )
    .get(domainId, visitorId);
  // SQLite EXISTS 返回 1（存在）或 0（不存在）
  return (row?.ok ?? 0) === 1;
}

/**
 * 查找指定父目录下的所有直接子节点。
 *
 * @param db - better-sqlite3 数据库实例
 * @param parentId - 父目录 document_id
 * @returns 子节点数组
 */
export function findChildrenByParent(
  parentId: string,
  db?: Database.Database,
): Documents[] {
  return resolveDb(db).prepare<string, Documents>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, head_commit_id, created_at, updated_at, permission,
              file_type, parent_id, is_dirty
       FROM documents WHERE parent_id = ? ORDER BY relative_path`,
    )
    .all(parentId);
}

/**
 * 统计指定父目录下的子节点数量。
 */
export function countChildrenByParent(
  parentId: string,
  db?: Database.Database,
): number {
  const row = resolveDb(db).prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM documents WHERE parent_id = ?`,
    )
    .get(parentId);
  return row?.c ?? 0;
}
