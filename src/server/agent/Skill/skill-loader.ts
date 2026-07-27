import fs from "node:fs";
import path from "node:path";
import { resolveSkillsRoot, skillSourceToUrl } from "../Config/config.js";

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  /** site 相对路径，如 core-concepts/domain.md */
  source?: string;
}

export interface SkillBody extends SkillMeta {
  content: string;
  /** 公网手册 URL，由 source 拼出 */
  url: string | null;
}

export class SkillLoader {
  private readonly root: string | null;

  constructor(root: string | null) {
    this.root = root;
  }
  isReady(): boolean {
    return Boolean(this.root && fs.existsSync(path.join(this.root, "index.json")));
  }

  list(): SkillMeta[] {
    if (!this.root) return [];
    const raw = fs.readFileSync(path.join(this.root, "index.json"), "utf8");
    return JSON.parse(raw) as SkillMeta[];
  }

  read(id: string): SkillBody | null {
    if (!this.root || !id || id.includes("..") || id.includes("/") || id.includes("\\")) {
      return null;
    }
    const meta = this.list().find((s) => s.id === id);
    if (!meta) return null;
    const file = path.join(this.root, id, "SKILL.md");
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
    const source =
      meta.source ??
      raw.match(/^source:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
    return {
      ...meta,
      source,
      content,
      url: skillSourceToUrl(source),
    };
  }
}

let cached: SkillLoader | null = null;

export function getSkillLoader(): SkillLoader {
  if (!cached) cached = new SkillLoader(resolveSkillsRoot());
  return cached;
}
