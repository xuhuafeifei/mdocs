import path from "node:path";
import { getConfig } from "../config/index.js";

export class StoragePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoragePathError";
  }
}

const RELATIVE_PATH_RX = /^[A-Za-z0-9_\-./\u4e00-\u9fa5]+$/;

export function normaliseDocRelativePath(input: string): string {
  const raw = input.trim();
  if (!raw) throw new StoragePathError("relative path is required");
  if (raw.startsWith("/")) throw new StoragePathError("path must be relative");
  if (raw.includes("\\")) throw new StoragePathError("use forward slashes");
  if (raw.includes("..")) throw new StoragePathError("path must not contain ..");
  if (!raw.toLowerCase().endsWith(".md")) {
    throw new StoragePathError("document path must end with .md");
  }
  if (!RELATIVE_PATH_RX.test(raw)) {
    throw new StoragePathError("path contains unsupported characters");
  }
  const norm = path.posix.normalize(raw);
  if (norm.startsWith("..") || norm.startsWith("/")) {
    throw new StoragePathError("path escapes docs root");
  }
  return norm;
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
