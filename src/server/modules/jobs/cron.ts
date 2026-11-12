import { Cron } from "croner";

/**
 * 用「上一秒之后的下一次 nextRun」是否落在当前秒，判断是否到点。
 * cron 表达式须为 6 段秒级（秒 分 时 日 月 周）。
 */
export function isCronDueAt(cronExpr: string, atMs: number): boolean {
  const expr = cronExpr?.trim();
  if (!expr) return false;
  const atSec = Math.floor(atMs / 1000) * 1000;
  const at = new Date(atSec);
  const from = new Date(atSec - 1000);
  try {
    const cron = new Cron(expr);
    const next = cron.nextRun(from);
    if (!next) return false;
    return Math.floor(next.getTime() / 1000) === Math.floor(at.getTime() / 1000);
  } catch {
    return false;
  }
}
