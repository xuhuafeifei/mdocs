import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { resolveDocAbsolutePath } from "./paths.js";

/** 单篇文档允许的最大字节数（2 MB），超过则拒绝写入。 */
const MAX_DOC_BYTES = 2 * 1024 * 1024;

/** 文档写入结果，包含内容哈希与字节数。 */
export interface WriteResult {
  contentHash: string;
  bytes: number;
}

/**
 * 将文档内容写入磁盘。
 *
 * @param domainId - 域 ID，用于隔离不同域的磁盘路径
 * @param relativePath - 文档的相对路径（如 "guide/getting-started.md"）
 * @param content - 要写入的 Markdown 文本内容
 * @returns 写入结果，含内容哈希与字节数
 */
export function writeDocument(domainId: string, relativePath: string, content: string): WriteResult {
  const buf = Buffer.from(content, "utf8");
  if (buf.byteLength > MAX_DOC_BYTES) {
    throw new Error("document is too large");
  }
  const abs = resolveDocAbsolutePath(domainId, relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true, mode: 0o700 });
  fs.writeFileSync(abs, buf, { mode: 0o600 });
  return {
    contentHash: sha256(buf),
    bytes: buf.byteLength,
  };
}

/**
 * 从磁盘读取文档内容。
 *
 * @param domainId - 域 ID
 * @param relativePath - 文档的相对路径
 * @returns 原始文本内容与内容的 SHA-256 哈希值
 */
export function readDocument(domainId: string, relativePath: string): { content: string; contentHash: string } {
  const abs = resolveDocAbsolutePath(domainId, relativePath);
  const buf = fs.readFileSync(abs);
  return {
    content: buf.toString("utf8"),
    contentHash: sha256(buf),
  };
}

/**
 * 删除指定相对路径对应的文档文件。
 *
 * @param domainId - 域 ID
 * @param relativePath - 要删除的文档相对路径
 */
export function deleteDocumentFile(domainId: string, relativePath: string): void {
  const abs = resolveDocAbsolutePath(domainId, relativePath);
  if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
}

/**
 * 计算给定 Buffer 的 SHA-256 十六进制摘要。
 */
export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
