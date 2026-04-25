import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { resolveDocAbsolutePath } from "./paths.js";

const MAX_DOC_BYTES = 2 * 1024 * 1024;

export interface WriteResult {
  contentHash: string;
  bytes: number;
}

export function writeDocument(relativePath: string, content: string): WriteResult {
  const buf = Buffer.from(content, "utf8");
  if (buf.byteLength > MAX_DOC_BYTES) {
    throw new Error("document is too large");
  }
  const abs = resolveDocAbsolutePath(relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true, mode: 0o700 });
  fs.writeFileSync(abs, buf, { mode: 0o600 });
  return {
    contentHash: sha256(buf),
    bytes: buf.byteLength,
  };
}

export function readDocument(relativePath: string): { content: string; contentHash: string } {
  const abs = resolveDocAbsolutePath(relativePath);
  const buf = fs.readFileSync(abs);
  return {
    content: buf.toString("utf8"),
    contentHash: sha256(buf),
  };
}

export function deleteDocumentFile(relativePath: string): void {
  const abs = resolveDocAbsolutePath(relativePath);
  if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
