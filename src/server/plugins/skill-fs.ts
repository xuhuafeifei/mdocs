/**
 * 私人 Skill 真身：tenant/{vid}/skills/<name>/SKILL.md
 * 可选 meta.json：{ description, updatedAt, id }
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  visitorSkillDir,
  visitorSkillMdPath,
  visitorSkillsRoot,
} from "./plugin-paths.js";

export type SkillFsRecord = {
  id: string;
  name: string;
  description: string;
  body: string;
  updatedAt: string;
};

type Meta = { id?: string; description?: string; updatedAt?: string };

function metaPath(visitorId: string, name: string): string {
  return path.join(visitorSkillDir(visitorId, name), "meta.json");
}

function readMeta(visitorId: string, name: string): Meta {
  const p = metaPath(visitorId, name);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Meta;
  } catch {
    return {};
  }
}

function writeMeta(
  visitorId: string,
  name: string,
  meta: Required<Meta>,
): void {
  fs.mkdirSync(visitorSkillDir(visitorId, name), { recursive: true, mode: 0o700 });
  fs.writeFileSync(metaPath(visitorId, name), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

export function listSkillsFs(visitorId: string): SkillFsRecord[] {
  const root = visitorSkillsRoot(visitorId);
  if (!fs.existsSync(root)) return [];
  const out: SkillFsRecord[] = [];
  for (const name of fs.readdirSync(root)) {
    const md = visitorSkillMdPath(visitorId, name);
    if (!fs.existsSync(md)) continue;
    const meta = readMeta(visitorId, name);
    const st = fs.statSync(md);
    out.push({
      id: meta.id || name,
      name,
      description: meta.description ?? "",
      body: fs.readFileSync(md, "utf8"),
      updatedAt: meta.updatedAt || st.mtime.toISOString(),
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSkillFs(
  visitorId: string,
  name: string,
): SkillFsRecord | null {
  const n = name.trim();
  const md = visitorSkillMdPath(visitorId, n);
  if (!fs.existsSync(md)) return null;
  const meta = readMeta(visitorId, n);
  const st = fs.statSync(md);
  return {
    id: meta.id || n,
    name: n,
    description: meta.description ?? "",
    body: fs.readFileSync(md, "utf8"),
    updatedAt: meta.updatedAt || st.mtime.toISOString(),
  };
}

export function writeSkillFs(input: {
  visitorId: string;
  name: string;
  description: string;
  body: string;
  id?: string;
  expectedUpdatedAt?: string;
}): SkillFsRecord {
  const existing = getSkillFs(input.visitorId, input.name);
  if (
    input.expectedUpdatedAt !== undefined &&
    existing &&
    existing.updatedAt !== input.expectedUpdatedAt
  ) {
    throw new Error("skill_update_conflict");
  }
  const id = input.id || existing?.id || randomUUID();
  const updatedAt = new Date().toISOString();
  fs.mkdirSync(visitorSkillDir(input.visitorId, input.name), {
    recursive: true,
    mode: 0o700,
  });
  fs.writeFileSync(visitorSkillMdPath(input.visitorId, input.name), input.body, "utf8");
  writeMeta(input.visitorId, input.name, {
    id,
    description: input.description,
    updatedAt,
  });
  return {
    id,
    name: input.name,
    description: input.description,
    body: input.body,
    updatedAt,
  };
}

export function renameSkillFs(
  visitorId: string,
  fromName: string,
  toName: string,
): void {
  if (fromName === toName) return;
  const from = visitorSkillDir(visitorId, fromName);
  const to = visitorSkillDir(visitorId, toName);
  if (!fs.existsSync(from)) throw new Error("skill_not_found");
  if (fs.existsSync(to)) throw new Error("skill_name_taken");
  fs.renameSync(from, to);
}

export function deleteSkillFs(visitorId: string, name: string): boolean {
  const dir = visitorSkillDir(visitorId, name);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}
