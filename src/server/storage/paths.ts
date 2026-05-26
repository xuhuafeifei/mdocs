import path from "node:path";
import { getConfig } from "../config/index.js";
import { DocPathError, normaliseDocRelativePath as sharedNormaliseDocRelativePath } from "../../shared/docPath.js";

/** 存储路径相关错误，用于包装共享模块抛出的路径异常。 */
export class StoragePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoragePathError";
  }
}

/**
 * 规范化文档相对路径。
 * 调用共享模块的实现，并将 DocPathError 转换为 StoragePathError 抛出。
 */
export function normaliseDocRelativePath(input: string): string {
  try {
    return sharedNormaliseDocRelativePath(input);
  } catch (e) {
    if (e instanceof DocPathError) throw new StoragePathError(e.message);
    throw e;
  }
}

/**
 * 将相对路径解析为 docsDir 下的绝对路径。
 * 解析后会校验结果是否仍在 docsDir 内部，防止路径穿越。
 */
export function resolveDocAbsolutePath(domainId: string, relativePath: string): string {
  const cfg = getConfig();
  const safe = normaliseDocRelativePath(relativePath);
  const abs = path.resolve(cfg.docsDir, domainId, safe);
  // 校验解析后的路径未逃逸出该域的文档根目录
  if (!abs.startsWith(path.resolve(cfg.docsDir, domainId) + path.sep)) {
    throw new StoragePathError("resolved path escapes domain root");
  }
  return abs;
}

/**
 * 把「正文 SHA-256」解析成历史快照在磁盘上的绝对路径。
 *
 * 与文档树路径无关：不认 domain_id / relative_path，只认内容 hash。
 * 布局：`{commitsDir}/{hash[0:2]}/{hash[2:]}`（两级目录，避免单目录文件过多）。
 *
 * 数据根由 `MDOCS_DATA_DIR`（默认 `~/.mdocs`）决定；换数据根时请整包迁移
 * `files/commits/`，否则 DB 里的 blob_ref 仍能对上路径规则，但文件不在新目录下。
 *
 * DB 中 `document_commits.blob_ref` 存相对路径 `ab/cdef...`（相对 commitsDir），
 * 读历史时用 `path.join(getConfig().commitsDir, blob_ref)` 或本函数（传入 content_hash）。
 */
export function resolveCommitBlobAbsolutePath(contentHash: string): string {
  const cfg = getConfig();
  const safe = contentHash.trim();
  // 必须是 publish 时写入的 64 位十六进制 SHA-256
  if (!/^[a-f0-9]{64}$/.test(safe)) {
    throw new StoragePathError("invalid content hash");
  }
  // 例：hash=a1b2... → ~/.mdocs/files/commits/a1/a1b2...
  const abs = path.resolve(cfg.commitsDir, safe.slice(0, 2), safe.slice(2));
  if (!abs.startsWith(path.resolve(cfg.commitsDir) + path.sep)) {
    throw new StoragePathError("resolved path escapes commits root");
  }
  return abs;
}
