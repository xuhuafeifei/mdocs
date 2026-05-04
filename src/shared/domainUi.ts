import type { DomainSummary } from "./types/domain";

export const DEFAULT_DOMAIN_ID = "default" as const;

export const DOMAIN_PERMISSIONS = ["public", "restricted", "private"] as const;
export type DomainPermissionValue = (typeof DOMAIN_PERMISSIONS)[number];
export type DomainPermissionFilter = "all" | DomainPermissionValue;

export function isBuiltInDomainId(domainId: string): boolean {
  return domainId === DEFAULT_DOMAIN_ID;
}

export function isDomainCreator(d: DomainSummary, visitorId: string | null): boolean {
  return visitorId !== null && d.creatorVisitorId === visitorId;
}

/** Rename / change permission / delete blocked when domain has documents (server + UI). */
export function isDomainStructurallyLocked(d: DomainSummary): boolean {
  return d.docCount > 0;
}
