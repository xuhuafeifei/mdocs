/**
 * 组装注入 Agent system 的灵魂文本（全局 → 全局旁路 → 个人 → 个人旁路）。
 */
import fs from "node:fs";
import path from "node:path";
import { ensureGlobalSoulShell, ensureVisitorSoulShell } from "./ensure-shells.js";
import {
  globalSoulDir,
  globalSoulMdocsPath,
  visitorSoulDir,
  visitorSoulMdocsPath,
  SOUL_FILENAME,
} from "./paths.js";

const SINGLE_FILE_MAX = 32 * 1024;
const TOTAL_MAX = 64 * 1024;

function readCapped(filePath: string, remaining: number): string | null {
  if (remaining <= 0) return null;
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size <= 0) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const slice = raw.slice(0, Math.min(SINGLE_FILE_MAX, remaining));
    return slice.trim() ? slice : null;
  } catch {
    return null;
  }
}

/** 同目录 .md，排除 mdocs.md；按文件名排序。 */
function listSidecars(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".md") && n !== SOUL_FILENAME)
      .sort((a, b) => a.localeCompare(b))
      .map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

/**
 * 返回可追加到 systemPrompt 的块；无内容则空字符串。
 * 会确保空壳存在。
 */
export function loadSoulPromptSection(visitorId: string): string {
  ensureGlobalSoulShell();
  ensureVisitorSoulShell(visitorId);

  const parts: string[] = [];
  let remaining = TOTAL_MAX;

  const pushLabeled = (label: string, filePath: string) => {
    const body = readCapped(filePath, remaining);
    if (!body) return;
    remaining -= body.length;
    parts.push(`### ${label}\n\n${body}`);
  };

  pushLabeled("全局灵魂 (soul/mdocs.md)", globalSoulMdocsPath());
  for (const side of listSidecars(globalSoulDir())) {
    pushLabeled(`全局旁路 (${path.basename(side)})`, side);
  }
  pushLabeled("个人灵魂 (tenant/…/soul/mdocs.md)", visitorSoulMdocsPath(visitorId));
  for (const side of listSidecars(visitorSoulDir(visitorId))) {
    pushLabeled(`个人旁路 (${path.basename(side)})`, side);
  }

  if (parts.length === 0) return "";
  return ["## mdocs 灵魂约定", "", ...parts].join("\n");
}
