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
