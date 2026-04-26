export interface DomainSummary {
  domainId: string;
  domainName: string;
  permission: string;
}

/** Private-type domains: exactly one domain member (the domain owner). No multi-member list. */
export const PRIVATE_DOMAIN_MAX_MEMBERS = 1 as const;
