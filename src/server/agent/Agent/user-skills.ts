/**
 * 私人 Skill：真身在 tenant/.../skills/<name>/SKILL.md。
 */
import { useLogger } from "../../logger/logger.js";
import {
  deleteSkillFs,
  getSkillFs,
  listSkillsFs,
  renameSkillFs,
  writeSkillFs,
  type SkillFsRecord,
} from "../../plugins/skill-fs.js";

const log = useLogger("user-skills");

export const USER_SKILL_BODY_MAX_CHARS = 32 * 1024;
export const USER_SKILL_REF_MAX = 5;
const NAME_MAX = 64;
const DESC_MAX = 200;

export const USER_SKILL_NAME_RE = /^[A-Za-z0-9_]+$/;

export type UserSkillPublic = {
  id: string;
  name: string;
  description: string;
  body: string;
  updatedAt: string;
};

function toPublic(r: SkillFsRecord): UserSkillPublic {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    body: r.body,
    updatedAt: r.updatedAt,
  };
}

export function listUserSkills(ownerVisitorId: string): UserSkillPublic[] {
  return listSkillsFs(ownerVisitorId).map(toPublic);
}

export function getUserSkillByName(
  ownerVisitorId: string,
  name: string,
): UserSkillPublic | null {
  const r = getSkillFs(ownerVisitorId, name.trim());
  return r ? toPublic(r) : null;
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
  if (getSkillFs(input.ownerVisitorId, name)) {
    throw new Error("skill_name_taken");
  }
  return toPublic(
    writeSkillFs({
      visitorId: input.ownerVisitorId,
      name,
      description,
      body,
    }),
  );
}

export function updateUserSkillByName(input: {
  ownerVisitorId: string;
  currentName: string;
  name: string;
  description?: string;
  body: string;
  expectedUpdatedAt?: string;
}): UserSkillPublic {
  const existing = getSkillFs(input.ownerVisitorId, input.currentName.trim());
  if (!existing) throw new Error("skill_not_found");
  if (
    input.expectedUpdatedAt !== undefined &&
    input.expectedUpdatedAt !== existing.updatedAt
  ) {
    throw new Error("skill_update_conflict");
  }
  const name = normalizeName(input.name);
  const description = normalizeDescription(input.description);
  const body = normalizeBody(input.body);
  if (name !== existing.name) {
    if (getSkillFs(input.ownerVisitorId, name)) throw new Error("skill_name_taken");
    renameSkillFs(input.ownerVisitorId, existing.name, name);
  }
  return toPublic(
    writeSkillFs({
      visitorId: input.ownerVisitorId,
      name,
      description,
      body,
      id: existing.id,
      expectedUpdatedAt: undefined,
    }),
  );
}

/** @deprecated 按 id 更新；优先用 updateUserSkillByName */
export function updateUserSkill(input: {
  ownerVisitorId: string;
  id: string;
  name: string;
  description?: string;
  body: string;
}): UserSkillPublic {
  const existing = listUserSkills(input.ownerVisitorId).find((s) => s.id === input.id);
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
  const ok = deleteSkillFs(ownerVisitorId, name.trim());
  if (!ok) throw new Error("skill_not_found");
}

export function removeUserSkill(ownerVisitorId: string, id: string): void {
  const hit = listUserSkills(ownerVisitorId).find((s) => s.id === id);
  if (!hit) throw new Error("skill_not_found");
  removeUserSkillByName(ownerVisitorId, hit.name);
}

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

export const normalizeSkillIds = normalizeSkillRefs;

export function resolveSkillExpandBlocks(
  ownerVisitorId: string,
  refs: string[],
): { id: string; name: string; content: string }[] {
  if (refs.length === 0) return [];
  const ordered: UserSkillPublic[] = [];
  const used = new Set<string>();
  for (const ref of refs) {
    let skill = getUserSkillByName(ownerVisitorId, ref);
    if (!skill) {
      skill = listUserSkills(ownerVisitorId).find((s) => s.id === ref) ?? null;
    }
    if (!skill || used.has(skill.id)) {
      if (!skill) {
        log.warn("skill missing or foreign, skip: %s (visitor %s)", ref, ownerVisitorId);
      }
      continue;
    }
    used.add(skill.id);
    ordered.push(skill);
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
