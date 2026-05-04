import type { DomainSummary } from "../../shared/types/domain";
import { DEFAULT_DOMAIN_ID } from "@shared/domainUi";
import { fetchDomainsApi } from "./endpoints";

export const FALLBACK_DOMAIN_SUMMARY: DomainSummary = {
  domainId: DEFAULT_DOMAIN_ID,
  domainName: "Default",
  permission: "public",
  creatorVisitorId: "",
  docCount: 0,
};

export async function fetchDomainsSafe(): Promise<DomainSummary[]> {
  try {
    return await fetchDomainsApi();
  } catch {
    return [FALLBACK_DOMAIN_SUMMARY];
  }
}

export function pickInitialDomainId(doms: DomainSummary[], visitorId: string): string {
  return (
    doms.find((d) => d.domainId === visitorId)?.domainId ??
    doms.find((d) => d.domainId === DEFAULT_DOMAIN_ID)?.domainId ??
    doms[0]?.domainId ??
    DEFAULT_DOMAIN_ID
  );
}
