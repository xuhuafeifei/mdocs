import type { DomainMemberTemplates } from "../entity/domain-member-template.entity.js";
import type { DomainMemberTemplateResponse } from "../response/domain-member-template.response.js";

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

/** 进参 → 待插入的表行（id 为 null）。 */
export function toDomainMemberTemplates(input: {
  displayName: string;
  visitorIds: Iterable<string>;
  createVisitorId: string;
  createTime: string;
  updateTime: string;
}): DomainMemberTemplates {
  return {
    id: null,
    display_name: input.displayName.trim(),
    domain_visitor_ids: normaliseVisitorIdsToCsv(input.visitorIds),
    create_visitor_id: input.createVisitorId,
    create_time: input.createTime,
    update_time: input.updateTime,
  };
}

/** 已有行上的更新字段 → 完整 Entity（保留 id / create_*）。 */
export function toDomainMemberTemplatesUpdate(
  existing: DomainMemberTemplates,
  input: { displayName: string; visitorIds: Iterable<string>; updateTime: string },
): DomainMemberTemplates {
  return {
    ...existing,
    display_name: input.displayName.trim(),
    domain_visitor_ids: normaliseVisitorIdsToCsv(input.visitorIds),
    update_time: input.updateTime,
  };
}

/** Entity → Response（蛇形表行 → 驼峰出参）。 */
export function toDomainMemberTemplateResponse(
  row: DomainMemberTemplates,
): DomainMemberTemplateResponse {
  if (row.id == null) {
    throw new Error("domain member template missing id");
  }
  return {
    id: row.id,
    displayName: row.display_name,
    visitorIds: visitorIdsFromStoredCsv(row.domain_visitor_ids),
    createTime: row.create_time,
    updateTime: row.update_time,
  };
}
