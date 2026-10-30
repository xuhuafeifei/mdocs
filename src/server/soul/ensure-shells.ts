import fs from "node:fs";
import {
  globalSoulDir,
  globalSoulMdocsPath,
  visitorSoulDir,
  visitorSoulMdocsPath,
  SOUL_FILENAME,
} from "./paths.js";

const GLOBAL_SHELL = `# mdocs.md（全局）

写在本文件的约定会进入智能助手的系统提示（所有访客共享）。
同目录下其它 .md 为插件旁路说明；卸载对应插件时删除该旁路文件即可。
`;

const VISITOR_SHELL = `# mdocs.md（个人）

写在本文件的约定只作用于当前访客的智能助手。
同目录旁路 .md 规则同全局 soul/。
`;

/** 确保全局 soul 目录与空壳存在（不覆盖已有内容）。 */
export function ensureGlobalSoulShell(): void {
  fs.mkdirSync(globalSoulDir(), { recursive: true, mode: 0o700 });
  const p = globalSoulMdocsPath();
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, GLOBAL_SHELL, "utf8");
  }
}

/** 确保某访客 soul 空壳存在。 */
export function ensureVisitorSoulShell(visitorId: string): void {
  const id = visitorId.trim();
  if (!id) return;
  fs.mkdirSync(visitorSoulDir(id), { recursive: true, mode: 0o700 });
  const p = visitorSoulMdocsPath(id);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, VISITOR_SHELL, "utf8");
  }
}

export { SOUL_FILENAME };
