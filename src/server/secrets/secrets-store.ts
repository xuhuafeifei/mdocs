/**
 * 简单的 secrets 文件存储。
 *
 * 存 ~/.mdocs/secrets/agent-api-keys.json，文件权限 0600。
 * 结构：{ [configId]: apiKey }
 *
 * 原子写入：先写临时文件，再 rename 覆盖，避免写一半损坏。
 */
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../config/index.js';

const SECRETS_DIR = 'secrets';
const API_KEYS_FILE = 'agent-api-keys.json';

function getApiKeysFilePath(): string {
  const cfg = getConfig();
  return path.join(cfg.dataDir, SECRETS_DIR, API_KEYS_FILE);
}

function getSecretsDirPath(): string {
  const cfg = getConfig();
  return path.join(cfg.dataDir, SECRETS_DIR);
}

/** 读取所有 api keys。文件不存在返回空对象。 */
export function readAllAgentApiKeys(): Record<string, string> {
  const filePath = getApiKeysFilePath();
  if (!fs.existsSync(filePath)) return {};

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
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

/** 获取单个配置的 api key，不存在返回 null。 */
export function getAgentApiKey(configId: string): string | null {
  const all = readAllAgentApiKeys();
  return all[configId] ?? null;
}

/** 设置单个配置的 api key（原子写入）。 */
export function setAgentApiKey(configId: string, apiKey: string): void {
  const all = readAllAgentApiKeys();
  all[configId] = apiKey;
  writeAllAgentApiKeys(all);
}

/** 删除单个配置的 api key。 */
export function deleteAgentApiKey(configId: string): void {
  const all = readAllAgentApiKeys();
  if (configId in all) {
    delete all[configId];
    writeAllAgentApiKeys(all);
  }
}

/** 批量写入（迁移用）。 */
export function bulkSetAgentApiKeys(entries: Array<{ configId: string; apiKey: string }>): void {
  const all = readAllAgentApiKeys();
  for (const { configId, apiKey } of entries) {
    all[configId] = apiKey;
  }
  writeAllAgentApiKeys(all);
}

/** 原子写入整个文件。 */
function writeAllAgentApiKeys(data: Record<string, string>): void {
  const dirPath = getSecretsDirPath();
  const filePath = getApiKeysFilePath();

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }

  const tmpPath = `${filePath}.tmp.${process.pid}`;
  const content = JSON.stringify(data, null, 2);

  try {
    fs.writeFileSync(tmpPath, content, { mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
  } finally {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
}
