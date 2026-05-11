/**
 * 前端通用工具函数
 * 包含错误翻译（后端错误码 → 用户友好提示）、域名称本地化、权限标签翻译、路径处理等。
 */
import { ApiRequestError } from "../services/client";
import { DocPathError } from "../../shared/docPath";
import { PATH_ERROR_MESSAGE_MAP, STORAGE_ERROR_MESSAGE_MAP } from "../i18n/errors";
import type { TranslationKey } from "../i18n/types";

/**
 * 统一错误翻译：将各类异常转换为用户友好的本地化提示。
 * 优先级：ApiRequestError → DocPathError → 通用 Error → 其他。
 */
export function translateError(
  t: (k: TranslationKey, vars?: Record<string, string>) => string,
  err: unknown,
): string {
  if (err instanceof ApiRequestError) {
    // 后端已返回用户友好的中文消息（如"目录下有 X 篇文档不属于你，无法删除"），
    // 直接展示，不被 i18n 通用翻译覆盖。
    return err.message;
  }
  if (err instanceof DocPathError) {
    const key = PATH_ERROR_MESSAGE_MAP[err.message];
    if (key) return t(key);
    return err.message;
  }
  if (err instanceof Error) {
    const key = PATH_ERROR_MESSAGE_MAP[err.message] ?? STORAGE_ERROR_MESSAGE_MAP[err.message];
    if (key) return t(key);
    return err.message;
  }
  return String(err);
}

/**
 * 域名称本地化：将系统内部名称（如 "Default"、"xxx个人域"）翻译为当前语言显示文本。
 */
export function localizeDomainName(
  name: string,
  lang: "en" | "zh",
  t: (k: TranslationKey, vars?: Record<string, string>) => string,
): string {
  if (name === "Default") return t("defaultDomain");
  const suffix = "个人域";
  if (name.endsWith(suffix)) {
    const base = name.slice(0, -suffix.length);
    return base + t("personalDomainSuffix");
  }
  return name;
}

/**
 * 将域权限值翻译为可读的本地化标签。
 */
export function domainPermissionLabel(
  permission: string,
  t: (k: TranslationKey, vars?: Record<string, string>) => string,
): string {
  if (permission === "public") return t("domainPublic");
  if (permission === "restricted") return t("domainRestricted");
  if (permission === "private") return t("domainPrivate");
  return permission;
}

/**
 * 从文档相对路径中提取父目录路径，用于「新建」时默认定位到当前所在文件夹。
 */
export function parentDirForCreates(relativePath: string): string {
  const i = relativePath.lastIndexOf("/");
  return i === -1 ? "" : relativePath.slice(0, i);
}
