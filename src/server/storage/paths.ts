import path from "node:path";
import { getConfig } from "../config/index.js";
import { DocPathError, normaliseDocRelativePath as sharedNormaliseDocRelativePath } from "../../shared/docPath.js";

export class StoragePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoragePathError";
  }
}

export function normaliseDocRelativePath(input: string): string {
  try {
    return sharedNormaliseDocRelativePath(input);
  } catch (e) {
    if (e instanceof DocPathError) throw new StoragePathError(e.message);
    throw e;
  }
}

export function resolveDocAbsolutePath(relativePath: string): string {
  const cfg = getConfig();
  const safe = normaliseDocRelativePath(relativePath);
  const abs = path.resolve(cfg.docsDir, safe);
  if (!abs.startsWith(path.resolve(cfg.docsDir) + path.sep)) {
    throw new StoragePathError("resolved path escapes docs root");
  }
  return abs;
}
