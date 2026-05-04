import type Database from "better-sqlite3";

export interface DomainMemberTemplateRow {
  id: number;
  display_name: string;
  domain_visitor_ids: string;
  create_visitor_id: string;
  create_time: string;
  update_time: string;
}

/** 规范化 visitor_id 列表并拼成逗号串（去空、去重、保序）。 */
export function normaliseVisitorIdsToCsv(visitorIds: Iterable<string>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of visitorIds) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.join(",");
}

/** 从逗号分隔串解析 visitor_id 列表（去空、去重、保序）。 */
export function visitorIdsFromStoredCsv(stored: string): string[] {
  if (!stored.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stored.split(",")) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function listDomainMemberTemplates(db: Database.Database, createVisitorId: string): DomainMemberTemplateRow[] {
  return db
    .prepare<string, DomainMemberTemplateRow>(
      `SELECT id, display_name, domain_visitor_ids, create_visitor_id, create_time, update_time
       FROM domain_member_templates
       WHERE create_visitor_id = ?
       ORDER BY update_time DESC`,
    )
    .all(createVisitorId);
}

export function findDomainMemberTemplateById(
  db: Database.Database,
  id: number,
  createVisitorId: string,
): DomainMemberTemplateRow | undefined {
  return db
    .prepare<[number, string], DomainMemberTemplateRow>(
      `SELECT id, display_name, domain_visitor_ids, create_visitor_id, create_time, update_time
       FROM domain_member_templates
       WHERE id = ? AND create_visitor_id = ?`,
    )
    .get(id, createVisitorId);
}

export function insertDomainMemberTemplate(
  db: Database.Database,
  input: {
    displayName: string;
    domainVisitorIdsCsv: string;
    createVisitorId: string;
    createTime: string;
    updateTime: string;
  },
): number {
  const info = db
    .prepare(
      `INSERT INTO domain_member_templates (display_name, domain_visitor_ids, create_visitor_id, create_time, update_time)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.displayName.trim(),
      input.domainVisitorIdsCsv,
      input.createVisitorId,
      input.createTime,
      input.updateTime,
    );
  return Number(info.lastInsertRowid);
}

export function updateDomainMemberTemplate(
  db: Database.Database,
  id: number,
  createVisitorId: string,
  input: { displayName: string; domainVisitorIdsCsv: string; updateTime: string },
): boolean {
  const info = db
    .prepare(
      `UPDATE domain_member_templates
       SET display_name = ?, domain_visitor_ids = ?, update_time = ?
       WHERE id = ? AND create_visitor_id = ?`,
    )
    .run(input.displayName.trim(), input.domainVisitorIdsCsv, input.updateTime, id, createVisitorId);
  return info.changes > 0;
}

export function deleteDomainMemberTemplate(db: Database.Database, id: number, createVisitorId: string): boolean {
  const info = db
    .prepare(`DELETE FROM domain_member_templates WHERE id = ? AND create_visitor_id = ?`)
    .run(id, createVisitorId);
  return info.changes > 0;
}
