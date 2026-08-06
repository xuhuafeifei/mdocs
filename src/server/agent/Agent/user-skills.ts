import { randomUUID } from "node:crypto";
import { getDb } from "../../db/connection.js";
import {
  deleteAgentUserSkillByName,
  findAgentUserSkillById,
  findAgentUserSkillByName,
  findAgentUserSkillsByIds,
  findAgentUserSkillsByNames,
  insertAgentUserSkill,
  listAgentUserSkillsByOwner,
  updateAgentUserSkill,
  type AgentUserSkillRow,
} from "../../db/repositories/agent-user-skill.repo.js";
import { useLogger } from "../../logger/logger.js";

const log = useLogger("user-skills");

/** 单 skill body 字符上限 */
export const USER_SKILL_BODY_MAX_CHARS = 32 * 1024;
/** 单轮最多引用 */
export const USER_SKILL_REF_MAX = 5;
const NAME_MAX = 64;
const DESC_MAX = 200;

/** 英文、数字、下划线 */
export const USER_SKILL_NAME_RE = /^[A-Za-z0-9_]+$/;

export type UserSkillPublic = {
  id: string;
  name: string;
  description: string;
  body: string;
  updatedAt: string;
};

export function toPublicUserSkill(row: AgentUserSkillRow): UserSkillPublic {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: row.body,
    updatedAt: row.updated_at,
  };
}

export function listUserSkills(ownerVisitorId: string): UserSkillPublic[] {
  return listAgentUserSkillsByOwner(getDb(), ownerVisitorId).map(toPublicUserSkill);
}

export function getUserSkillByName(
  ownerVisitorId: string,
  name: string,
): UserSkillPublic | null {
  const row = findAgentUserSkillByName(getDb(), ownerVisitorId, name.trim());
  return row ? toPublicUserSkill(row) : null;
}

export function createUserSkill(input: {
  ownerVisitorId: string;
  name: string;
  description?: string;
  body: string;
}): UserSkillPublic {
  const name = normalizeName(input.name);
  const description = normalizeDescription(input.description);
  const body = normalizeBody(input.body);
  const db = getDb();
  if (findAgentUserSkillByName(db, input.ownerVisitorId, name)) {
    throw new Error("skill_name_taken");
  }
  const now = new Date().toISOString();
  const row: AgentUserSkillRow = {
    id: randomUUID(),
    owner_visitor_id: input.ownerVisitorId,
    name,
    description,
    body,
    updated_at: now,
  };
  try {
    insertAgentUserSkill(db, row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      throw new Error("skill_name_taken");
    }
    throw err;
  }
  return toPublicUserSkill(row);
}

export function updateUserSkillByName(input: {
  ownerVisitorId: string;
  /** 当前（修改前）名称 */
  currentName: string;
  name: string;
  description?: string;
  body: string;
}): UserSkillPublic {
  const db = getDb();
  const existing = findAgentUserSkillByName(
    db,
    input.ownerVisitorId,
    input.currentName.trim(),
  );
  if (!existing) throw new Error("skill_not_found");
  const name = normalizeName(input.name);
  const description = normalizeDescription(input.description);
  const body = normalizeBody(input.body);
  if (name !== existing.name) {
    const clash = findAgentUserSkillByName(db, input.ownerVisitorId, name);
    if (clash) throw new Error("skill_name_taken");
  }
  const now = new Date().toISOString();
  try {
    const ok = updateAgentUserSkill(db, {
      id: existing.id,
      owner_visitor_id: input.ownerVisitorId,
      name,
      description,
      body,
      updated_at: now,
    });
    if (!ok) throw new Error("skill_not_found");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "skill_not_found") throw err;
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      throw new Error("skill_name_taken");
    }
    throw err;
  }
  return {
    id: existing.id,
    name,
    description,
    body,
    updatedAt: now,
  };
}

/** @deprecated 设置页仍可能按 id 更新 */
export function updateUserSkill(input: {
  ownerVisitorId: string;
  id: string;
  name: string;
  description?: string;
  body: string;
}): UserSkillPublic {
  const existing = findAgentUserSkillById(getDb(), input.id, input.ownerVisitorId);
  if (!existing) throw new Error("skill_not_found");
  return updateUserSkillByName({
    ownerVisitorId: input.ownerVisitorId,
    currentName: existing.name,
    name: input.name,
    description: input.description,
    body: input.body,
  });
}

export function removeUserSkillByName(ownerVisitorId: string, name: string): void {
  const ok = deleteAgentUserSkillByName(getDb(), ownerVisitorId, name.trim());
  if (!ok) throw new Error("skill_not_found");
}

export function removeUserSkill(ownerVisitorId: string, id: string): void {
  const existing = findAgentUserSkillById(getDb(), id, ownerVisitorId);
  if (!existing) throw new Error("skill_not_found");
  removeUserSkillByName(ownerVisitorId, existing.name);
}

/** 规范化单轮引用：优先 skillNames；兼容旧 skillIds */
export function normalizeSkillRefs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const v = item.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= USER_SKILL_REF_MAX) break;
  }
  return out;
}

/** @deprecated 使用 normalizeSkillRefs */
export const normalizeSkillIds = normalizeSkillRefs;

/**
 * 按名称查本人 skill；缺失静默跳过。
 * refs 为名称；若像 UUID 则再按 id 兜底（旧 jsonl）。
 */
export function resolveSkillExpandBlocks(
  ownerVisitorId: string,
  refs: string[],
): { id: string; name: string; content: string }[] {
  if (refs.length === 0) return [];
  const db = getDb();
  const byName = findAgentUserSkillsByNames(db, ownerVisitorId, refs);
  const foundNames = new Set(byName.map((r) => r.name));
  const missing = refs.filter((r) => !foundNames.has(r));
  const byId =
    missing.length > 0 ? findAgentUserSkillsByIds(db, ownerVisitorId, missing) : [];
  const ordered: AgentUserSkillRow[] = [];
  const used = new Set<string>();
  for (const ref of refs) {
    const row =
      byName.find((r) => r.name === ref) ?? byId.find((r) => r.id === ref);
    if (!row || used.has(row.id)) {
      if (!row) {
        log.warn("skill missing or foreign, skip: %s (visitor %s)", ref, ownerVisitorId);
      }
      continue;
    }
    used.add(row.id);
    ordered.push(row);
  }
  return ordered.map((r) => ({
    id: r.id,
    name: r.name,
    content: formatSkillExpandBlock(r.id, r.name, r.body),
  }));
}

export function formatSkillExpandBlock(id: string, name: string, body: string): string {
  return `<skill id="${escapeAttr(id)}" name="${escapeAttr(name)}">\n${body}\n</skill>`;
}

export function normalizeName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new Error("skill_name_required");
  if (name.length > NAME_MAX) throw new Error("skill_name_too_long");
  if (!USER_SKILL_NAME_RE.test(name)) throw new Error("skill_name_invalid");
  return name;
}

export function normalizeDescription(raw: string | undefined): string {
  if (raw === undefined || raw === null) return "";
  const d = String(raw).trim();
  if (d.length > DESC_MAX) throw new Error("skill_description_too_long");
  return d;
}

export function normalizeBody(raw: string): string {
  const body = typeof raw === "string" ? raw : "";
  if (!body.trim()) throw new Error("skill_body_required");
  if (body.length > USER_SKILL_BODY_MAX_CHARS) throw new Error("skill_body_too_long");
  return body;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
