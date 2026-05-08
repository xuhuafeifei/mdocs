import { createHash, randomBytes, randomUUID } from "node:crypto";

/**
 * 生成一个新的访客唯一标识符（UUID v4）。
 *
 * @returns 访客 ID 字符串
 */
export function newVisitorId(): string {
  return randomUUID();
}

/**
 * 生成一个新的访客原始令牌。
 * 使用 32 字节随机数并通过 base64url 编码，保证 URL 安全且长度适中。
 *
 * @returns 原始访客令牌字符串
 */
export function newVisitorToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * 对原始访客令牌进行 SHA-256 哈希，用于安全存储。
 * 数据库中保存的是哈希值而非原始令牌，原始令牌仅在注册时返回给客户端一次。
 *
 * @param rawToken - 原始访客令牌
 * @returns SHA-256 十六进制哈希字符串
 */
export function hashVisitorToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
