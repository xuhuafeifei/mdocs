/**
 * 简单的 secrets 文件存储。
 *
 * 存 ~/.mdocs/secrets/api-keys.json，文件权限 0600。
 * 结构：{ [visitorId]: apiKey }
 *
 * 原子写入：先写临时文件，再 rename 覆盖，避免写一半损坏。
 */
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../config/index.js';

const SECRETS_DIR = 'secrets';
const API_KEYS_FILE = 'api-keys.json';

function getApiKeysFilePath(): string {
  const cfg = getConfig();
  // cfg.dataDir 是 ~/.mdocs 根
  return path.join(cfg.dataDir, SECRETS_DIR, API_KEYS_FILE);
}

function getSecretsDirPath(): string {
  const cfg = getConfig();
  return path.join(cfg.dataDir, SECRETS_DIR);
}

/** 读取所有 api keys。文件不存在返回空对象。 */
export function readAllApiKeys(): Record<string, string> {
  const filePath = getApiKeysFilePath();
  if (!fs.existsSync(filePath)) return {};

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // 只保留 string 值，过滤脏数据
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'string') result[k] = v;
      }
      return result;
    }
    return {};
  } catch {
    return {};
  }
}

/** 获取单个 visitor 的 api key，不存在返回 null。 */
export function getApiKey(visitorId: string): string | null {
  const all = readAllApiKeys();
  return all[visitorId] ?? null;
}

/** 设置单个 visitor 的 api key（原子写入）。 */
export function setApiKey(visitorId: string, apiKey: string): void {
  const all = readAllApiKeys();
  all[visitorId] = apiKey;
  writeAllApiKeys(all);
}

/** 删除单个 visitor 的 api key。 */
export function deleteApiKey(visitorId: string): void {
  const all = readAllApiKeys();
  if (visitorId in all) {
    delete all[visitorId];
    writeAllApiKeys(all);
  }
}

/** 原子写入整个文件。 */
function writeAllApiKeys(data: Record<string, string>): void {
  const dirPath = getSecretsDirPath();
  const filePath = getApiKeysFilePath();

  // 确保目录存在，权限 0700
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }

  const tmpPath = `${filePath}.tmp.${process.pid}`;
  const content = JSON.stringify(data, null, 2);

  try {
    // 写临时文件，权限 0600
    fs.writeFileSync(tmpPath, content, { mode: 0o600 });
    // 原子重命名覆盖
    fs.renameSync(tmpPath, filePath);
  } finally {
    // 清理临时文件（如果 rename 失败的话）
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
}
