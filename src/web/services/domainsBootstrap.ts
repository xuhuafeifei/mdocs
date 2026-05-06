/**
 * 域启动辅助模块
 * 在应用初始化时安全地加载域列表，并提供默认域选择策略：
 * 1. 优先选择当前访客的个人域
 * 2. 其次选择系统默认域
 * 3. 兜底返回 fallback 域，避免空状态
 */
import type { DomainSummary } from "../../shared/types/domain";
import { DEFAULT_DOMAIN_ID } from "@shared/domainUi";
import { fetchDomainsApi } from "./endpoints";

/**
 * 默认域的 fallback 数据。
 * 当后端异常时返回此数据，确保界面不会空白。
 */
export const FALLBACK_DOMAIN_SUMMARY: DomainSummary = {
  domainId: DEFAULT_DOMAIN_ID,
  domainName: "Default",
  permission: "public",
  creatorVisitorId: "",
  docCount: 0,
};

/**
 * 安全加载域列表：若后端异常则返回 fallback 默认域，避免界面空白。
 */
export async function fetchDomainsSafe(): Promise<DomainSummary[]> {
  try {
    return await fetchDomainsApi();
  } catch {
    // 后端异常时返回 fallback 默认域
    return [FALLBACK_DOMAIN_SUMMARY];
  }
}

/**
 * 挑选初始激活域的优先级策略：
 * 1. 当前访客的个人域 → 2. 系统默认域 → 3. 列表首个 → 4. 硬编码 fallback。
 */
export function pickInitialDomainId(doms: DomainSummary[], visitorId: string): string {
  return (
    // 优先选择当前访客的个人域（domainId 等于 visitorId）
    doms.find((d) => d.domainId === visitorId)?.domainId ??
    // 其次选择系统默认域
    doms.find((d) => d.domainId === DEFAULT_DOMAIN_ID)?.domainId ??
    // 再选列表中的第一个域
    doms[0]?.domainId ??
    // 最终兜底返回硬编码的默认域 ID
    DEFAULT_DOMAIN_ID
  );
}
