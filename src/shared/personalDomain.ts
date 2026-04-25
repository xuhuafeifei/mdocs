/** Personal workspace: `domain_id === visitor_id`, storage paths prefixed with `${visitorId}/`. */

export const PERSONAL_DOMAIN_NAME_SUFFIX = "个人域";

const MAX_DOMAIN_NAME_LEN = 200;

export function personalDomainDisplayName(visitorName: string): string {
  const n = visitorName.trim() + PERSONAL_DOMAIN_NAME_SUFFIX;
  return n.length <= MAX_DOMAIN_NAME_LEN ? n : n.slice(0, MAX_DOMAIN_NAME_LEN);
}

/** Strip leading `${domainId}/` when present (tree + client paths are domain-relative). */
export function stripDomainPathPrefix(domainId: string, storedRelativePath: string): string {
  const pre = `${domainId}/`;
  return storedRelativePath.startsWith(pre) ? storedRelativePath.slice(pre.length) : storedRelativePath;
}

/** Prefix user path for DB + disk when writing into personal domain. */
export function prefixPersonalDomainStoragePath(visitorId: string, userNormalisedPath: string): string {
  const pre = `${visitorId}/`;
  if (userNormalisedPath.startsWith(pre)) return userNormalisedPath;
  return `${pre}${userNormalisedPath}`;
}
