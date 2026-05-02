import { ApiRequestError } from "../services/client";
import { DocPathError } from "../../shared/docPath";
import { ERROR_CODE_MAP, PATH_ERROR_MESSAGE_MAP, STORAGE_ERROR_MESSAGE_MAP } from "../i18n/errors";
import type { TranslationKey } from "../i18n/types";

export function translateError(
  t: (k: TranslationKey, vars?: Record<string, string>) => string,
  err: unknown,
): string {
  if (err instanceof ApiRequestError) {
    const key = ERROR_CODE_MAP[err.code];
    if (key) return t(key);
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

export function parentDirForCreates(relativePath: string): string {
  const i = relativePath.lastIndexOf("/");
  return i === -1 ? "" : relativePath.slice(0, i);
}
