/**
 * Shared document permission constants and helpers.
 */
export const DocumentPermission = {
  PRIVATE: 0,
  DOMAIN_READ: 1,
  DOMAIN_WRITE: 2,
  PUBLIC_READ: 3,
  PUBLIC_WRITE: 4,
} as const;

export type DocumentPermissionValue =
  (typeof DocumentPermission)[keyof typeof DocumentPermission];

export function isPublicWritePermission(permission: number): boolean {
  return permission === DocumentPermission.PUBLIC_WRITE;
}

export function allowedPermissionsForDomain(domainPermission: string): DocumentPermissionValue[] {
  if (domainPermission === "public") {
    return [DocumentPermission.PUBLIC_READ, DocumentPermission.PUBLIC_WRITE];
  }
  if (domainPermission === "restricted") {
    return [DocumentPermission.DOMAIN_READ, DocumentPermission.DOMAIN_WRITE];
  }
  return [
    DocumentPermission.PRIVATE,
    DocumentPermission.DOMAIN_READ,
    DocumentPermission.DOMAIN_WRITE,
    DocumentPermission.PUBLIC_READ,
    DocumentPermission.PUBLIC_WRITE,
  ];
}
