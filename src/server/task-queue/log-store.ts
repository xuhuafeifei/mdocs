/**
 * 任务日志存储：JSON Lines 文件，每个任务一个文件。
 */
import fs from 'node:fs';
import path from 'node:path';
import type { LogEntry, LogLevel } from './types.js';

export class TaskLogStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  private filePath(taskId: string): string {
    // 把 / 替换成 _，避免路径穿越
    const safeId = taskId.replace(/\//g, '_').replace(/\.\./g, '');
    return path.join(this.dir, `${safeId}.log`);
  }

  /** 清空并重新开始写（任务开始时调用） */
  reset(taskId: string): void {
    const file = this.filePath(taskId);
    fs.writeFileSync(file, '');
  }

  /** 追加一条日志 */
  append(taskId: string, event: string, data?: any, level: LogLevel = 'info'): void {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      event,
      level,
      data,
    };
    const line = JSON.stringify(entry) + '\n';
    try {
      fs.appendFileSync(this.filePath(taskId), line);
    } catch {
      // 写日志失败不影响任务执行
    }
  }

  /** 读取最后 N 条日志 */
  readTail(taskId: string, limit = 50): LogEntry[] {
    const file = this.filePath(taskId);
    if (!fs.existsSync(file)) return [];

    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      const tail = lines.slice(-limit);
      return tail
        .map((line) => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return null;
          }
        })
        .filter((e): e is LogEntry => e !== null);
    } catch {
      return [];
    }
  }

  /** 读取最后一条日志 */
  readLast(taskId: string): LogEntry | null {
    const entries = this.readTail(taskId, 1);
    return entries[0] ?? null;
  }

  /** 获取日志文件 mtime（用于 stale 判断） */
  getMtime(taskId: string): number | null {
    const file = this.filePath(taskId);
    if (!fs.existsSync(file)) return null;
    try {
      return fs.statSync(file).mtimeMs;
    } catch {
      return null;
    }
  }

  /** 日志文件是否存在 */
  exists(taskId: string): boolean {
    return fs.existsSync(this.filePath(taskId));
  }
}
