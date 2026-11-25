/**
 * domain_member_templates 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 * 入参/返回均为表实体；不做 HTTP 映射、不做 CSV 拼装。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { DomainMemberTemplates } from "../entity/domain-member-template.entity.js";

export type { DomainMemberTemplates } from "../entity/domain-member-template.entity.js";

const COLUMNS = `id, display_name, domain_visitor_ids, create_visitor_id, create_time, update_time`;

/** 列出指定创建者拥有的所有域成员模板（按 update_time 降序）。 */
export function listDomainMemberTemplates(
  createVisitorId: string,
  db?: Database.Database,
): DomainMemberTemplates[] {
  return resolveDb(db)
    .prepare<string, DomainMemberTemplates>(
      `SELECT ${COLUMNS}
       FROM domain_member_templates
       WHERE create_visitor_id = ?
       ORDER BY update_time DESC`,
    )
    .all(createVisitorId);
}

/** 根据 ID 与创建者查询单个域成员模板。 */
export function findDomainMemberTemplateById(
  id: number,
  createVisitorId: string,
  db?: Database.Database,
): DomainMemberTemplates | undefined {
  return resolveDb(db)
    .prepare<[number, string], DomainMemberTemplates>(
      `SELECT ${COLUMNS}
       FROM domain_member_templates
       WHERE id = ? AND create_visitor_id = ?`,
    )
    .get(id, createVisitorId);
}

/**
 * 插入完整 Entity（id 传 null）。
 * @returns 生成的自增主键
 */
export function insertDomainMemberTemplate(
  row: DomainMemberTemplates,
  db?: Database.Database,
): number {
  const info = resolveDb(db)
    .prepare(
      `INSERT INTO domain_member_templates (
        display_name, domain_visitor_ids, create_visitor_id, create_time, update_time
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      row.display_name,
      row.domain_visitor_ids,
      row.create_visitor_id,
      row.create_time,
      row.update_time,
    );
  return Number(info.lastInsertRowid);
}

/**
 * 按完整 Entity 更新（WHERE id + create_visitor_id）。
 * @returns 是否实际修改了行
 */
export function updateDomainMemberTemplate(
  row: DomainMemberTemplates,
  db?: Database.Database,
): boolean {
  if (row.id == null) return false;
  const info = resolveDb(db)
    .prepare(
      `UPDATE domain_member_templates
       SET display_name = ?, domain_visitor_ids = ?, update_time = ?
       WHERE id = ? AND create_visitor_id = ?`,
    )
    .run(
      row.display_name,
      row.domain_visitor_ids,
      row.update_time,
      row.id,
      row.create_visitor_id,
    );
  return info.changes > 0;
}

/**
 * 删除指定域成员模板（ID + 创建者均匹配）。
 * @returns 是否实际删除了行
 */
export function deleteDomainMemberTemplate(
  id: number,
  createVisitorId: string,
  db?: Database.Database,
): boolean {
  const info = resolveDb(db)
    .prepare(`DELETE FROM domain_member_templates WHERE id = ? AND create_visitor_id = ?`)
    .run(id, createVisitorId);
  return info.changes > 0;
}
