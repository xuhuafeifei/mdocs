import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * 生成一个新的访客唯一标识符（UUID v4）。
 *
 * @returns 访客 ID 字符串
 */
export function newVisitorId(): string {
  return randomUUID();
}

/**
 * 生成一个新的会话唯一标识符（UUID v4）。
 *
 * @returns 会话 ID 字符串
 */
export function newSessionId(): string {
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

/**
 * 生成一个新的恢复码。
 * 格式：XXXX-XXXX-XXXX-XXXX（4 组 4 位大写字母+数字，共 20 字符）
 * 熵值约 80 bit，适合人类抄写。
 *
 * @returns 恢复码字符串
 */
export function newRecoveryCode(): string {
  const groups: string[] = [];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆的 0/O/1/I
  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 4; i++) {
      group += chars[Math.floor(Math.random() * chars.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/**
 * 对恢复码进行 SHA-256 哈希，用于安全存储。
 * 数据库中保存哈希值，原始恢复码仅在注册时展示一次。
 *
 * @param code - 原始恢复码
 * @returns SHA-256 十六进制哈希字符串
 */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase(), "utf8").digest("hex");
}

const PASSWORD_SALT = "mdocs-password-salt-v1";
const PASSWORD_KEYLEN = 32;

/**
 * 对密码进行 scrypt 哈希，用于安全存储。
 *
 * @param password - 明文密码
 * @returns scrypt 哈希的十六进制字符串
 */
export function hashPassword(password: string): string {
  return scryptSync(password, PASSWORD_SALT, PASSWORD_KEYLEN).toString("hex");
}

/**
 * 验证密码是否匹配哈希值。
 * 使用 timingSafeEqual 防止计时攻击。
 *
 * @param password - 明文密码
 * @param hash - 存储的哈希值
 * @returns 匹配返回 true，否则返回 false
 */
export function verifyPassword(password: string, hash: string): boolean {
  const derivedKey = scryptSync(password, PASSWORD_SALT, PASSWORD_KEYLEN);
  const storedKey = Buffer.from(hash, "hex");
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}
