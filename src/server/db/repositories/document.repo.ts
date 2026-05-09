import type Database from "better-sqlite3";

/** 文档在数据库中的行结构，对应 documents 表的所有字段。 */
export interface DocumentRow {
  document_id: string;
  domain_id: string;
  relative_path: string;
  display_name: string;
  owner_visitor_id: string;
  created_by: string;
  updated_by: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
  permission: number;
  file_type: string;
  parent_id: string | null;
}

/** 插入文档所需的输入参数。字段命名采用驼峰式，方便服务层调用。 */
export interface InsertDocumentInput {
  documentId: string;
  domainId: string;
  relativePath: string;
  displayName: string;
  ownerVisitorId: string;
  createdBy: string;
  updatedBy: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  permission: number;
  fileType?: string;
  parentId?: string | null;
}

/** 更新文档内容所需的输入参数。permission 为可选，不传则只更新内容相关字段。 */
export interface UpdateDocumentContentInput {
  documentId: string;
  displayName: string;
  contentHash: string;
  updatedBy: string;
  updatedAt: string;
  permission?: number;
}

/**
 * 统计指定域下的文档总数。
 *
 * @param db - better-sqlite3 数据库实例
 * @param domainId - 要统计的域 ID
 * @returns 该域下的文档数量
 */
export function countDocumentsByDomain(db: Database.Database, domainId: string): number {
  // 使用 COUNT(*) 统计满足 domain_id 条件的行数
  const row = db
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM documents WHERE domain_id = ?`,
    )
    .get(domainId);
  // 如果查询结果异常为空，兜底返回 0
  return row?.c ?? 0;
}

/**
 * 列出指定域下的所有文档，按相对路径升序排列。
 *
 * @param db - better-sqlite3 数据库实例
 * @param domainId - 目标域 ID
 * @returns 该域下所有文档的数据库行数组
 */
export function listDocumentsByDomain(db: Database.Database, domainId: string): DocumentRow[] {
  return db
    .prepare<string, DocumentRow>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, created_at, updated_at, permission,
              file_type, parent_id
       FROM documents WHERE domain_id = ? ORDER BY relative_path`,
    )
    .all(domainId);
}

/**
 * 根据文档 ID 查找单篇文档。
 *
 * @param db - better-sqlite3 数据库实例
 * @param documentId - 文档唯一标识
 * @returns 匹配的数据库行；未找到则返回 undefined
 */
export function findDocumentById(db: Database.Database, documentId: string): DocumentRow | undefined {
  return db
    .prepare<string, DocumentRow>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, created_at, updated_at, permission,
              file_type, parent_id
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
export function findDocumentByPath(db: Database.Database, domainId: string, relativePath: string): DocumentRow | undefined {
  return db
    .prepare<[string, string], DocumentRow>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, created_at, updated_at, permission,
              file_type, parent_id
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
export function insertDocument(db: Database.Database, input: InsertDocumentInput): void {
  db.prepare(
    `INSERT INTO documents
     (document_id, domain_id, relative_path, display_name, owner_visitor_id,
      created_by, updated_by, content_hash, created_at, updated_at, permission,
      file_type, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.documentId,
    input.domainId,
    input.relativePath,
    input.displayName,
    input.ownerVisitorId,
    input.createdBy,
    input.updatedBy,
    input.contentHash,
    input.createdAt,
    input.updatedAt,
    input.permission,
    input.fileType ?? 'md',
    input.parentId ?? null,
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
export function updateDocumentContent(db: Database.Database, input: UpdateDocumentContentInput): void {
  // 根据是否传入 permission 决定使用哪条 SQL
  if (input.permission !== undefined) {
    db.prepare(
      `UPDATE documents
       SET display_name = ?, content_hash = ?, updated_by = ?, updated_at = ?, permission = ?
       WHERE document_id = ?`,
    ).run(input.displayName, input.contentHash, input.updatedBy, input.updatedAt, input.permission, input.documentId);
  } else {
    db.prepare(
      `UPDATE documents
       SET display_name = ?, content_hash = ?, updated_by = ?, updated_at = ?
       WHERE document_id = ?`,
    ).run(input.displayName, input.contentHash, input.updatedBy, input.updatedAt, input.documentId);
  }
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
export function deleteDocument(db: Database.Database, documentId: string): void {
  db.prepare(`DELETE FROM documents WHERE document_id = ?`).run(documentId);
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
  db: Database.Database,
  domainId: string,
  pathPrefix: string,
): DocumentRow[] {
  return db
    .prepare<[string, string], DocumentRow>(
      `SELECT * FROM documents WHERE domain_id = ? AND relative_path LIKE ?`,
    )
    .all(domainId, `${pathPrefix}%`);
}

/** 文档邀请在数据库中的行结构，对应 document_invites 表。 */
export interface DocumentInviteRow {
  document_id: string;
  visitor_id: string;
  permission: string;
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
  db: Database.Database,
  documentId: string,
  visitorId: string,
): DocumentInviteRow | undefined {
  return db
    .prepare<[string, string], DocumentInviteRow>(
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
 *
 * @param db - better-sqlite3 数据库实例
 * @param documentId - 文档 ID
 * @param visitorId - 被邀请的访客 ID
 * @param permission - 授予的权限（read / edit）
 */
export function insertDocumentInvite(
  db: Database.Database,
  documentId: string,
  visitorId: string,
  permission: string,
): void {
  db.prepare(
    `INSERT INTO document_invites (document_id, visitor_id, permission) VALUES (?, ?, ?)
     ON CONFLICT(document_id, visitor_id) DO UPDATE SET permission = excluded.permission`,
  ).run(documentId, visitorId, permission);
}

/**
 * 删除指定文档对指定访客的邀请记录。
 *
 * @param db - better-sqlite3 数据库实例
 * @param documentId - 文档 ID
 * @param visitorId - 访客 ID
 */
export function deleteDocumentInvite(db: Database.Database, documentId: string, visitorId: string): void {
  db.prepare(`DELETE FROM document_invites WHERE document_id = ? AND visitor_id = ?`).run(documentId, visitorId);
}

/**
 * 列出指定文档的所有邀请记录。
 *
 * @param db - better-sqlite3 数据库实例
 * @param documentId - 文档 ID
 * @returns 该文档的全部邀请记录数组
 */
export function listDocumentInvites(db: Database.Database, documentId: string): DocumentInviteRow[] {
  return db
    .prepare<string, DocumentInviteRow>(
      `SELECT document_id, visitor_id, permission FROM document_invites WHERE document_id = ?`,
    )
    .all(documentId);
}

/**
 * 查的是什么：当前访客在「文档邀请」里涉及到的所有域 ID（同一域多篇邀请只算一次）。
 * 怎么实现：`document_invites` 按 `document_id` 关联 `documents`，用 `visitor_id = ?` 过滤，`DISTINCT` 取 `domain_id`。
 *
 * 用途：批量列域时，可预先查出所有「因文档邀请而可见」的域ID集合，
 * 避免在 resolveDomainAccess 中逐域查库。
 *
 * @param db - better-sqlite3 数据库实例
 * @param visitorId - 当前访客 ID
 * @returns 该访客被邀请过的所有文档所属域的 ID 数组（去重）
 */
export function listDomainIdsWithDocumentInviteForVisitor(db: Database.Database, visitorId: string): string[] {
  const rows = db
    .prepare<string, { domain_id: string }>(
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
 * 用途：在 resolveDomainAccess 中判断 restricted/private 域是否因文档邀请而对访客可见。
 *
 * @param db - better-sqlite3 数据库实例
 * @param domainId - 目标域 ID
 * @param visitorId - 当前访客 ID
 * @returns true 表示该域里至少有一篇文档邀请了这个访客
 */
export function hasDocumentInviteInDomain(
  db: Database.Database,
  domainId: string,
  visitorId: string,
): boolean {
  const row = db
    .prepare<[string, string], { ok: number }>(
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
export function findChildrenByParent(db: Database.Database, parentId: string): DocumentRow[] {
  return db
    .prepare<string, DocumentRow>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, created_at, updated_at, permission,
              file_type, parent_id
       FROM documents WHERE parent_id = ? ORDER BY relative_path`,
    )
    .all(parentId);
}

/**
 * 统计指定父目录下的子节点数量。
 */
export function countChildrenByParent(db: Database.Database, parentId: string): number {
  const row = db
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM documents WHERE parent_id = ?`,
    )
    .get(parentId);
  return row?.c ?? 0;
}
