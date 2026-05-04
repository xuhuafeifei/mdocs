import { api } from "./client";
import type { DocumentDetail } from "../../shared/types/document";
import type {
  VisitorDirectoryEntry,
  VisitorMeResponse,
  VisitorPublic,
  VisitorRegisterResponse,
} from "../../shared/types/visitor";
import type { TreeNode } from "../../shared/types/tree";
import type { DomainSummary, DomainMemberListEntry } from "../../shared/types/domain";
import type { DomainMemberTemplate } from "../../shared/types/domainMemberTemplate";

export function registerVisitorApi(visitorName: string): Promise<VisitorRegisterResponse> {
  return api<VisitorRegisterResponse>("/api/visitors/register", {
    method: "POST",
    body: JSON.stringify({ visitorName }),
  });
}

export async function fetchMe(): Promise<VisitorPublic> {
  const res = await api<VisitorMeResponse>("/api/visitors/me");
  return res.visitor;
}

export function fetchVisitorsDirectoryApi(): Promise<VisitorDirectoryEntry[]> {
  return api<{ visitors: VisitorDirectoryEntry[] }>("/api/visitors").then((d) => d.visitors);
}

export function fetchDomainsApi(): Promise<DomainSummary[]> {
  return api<DomainSummary[]>("/api/domains");
}

export function createDomainApi(input: {
  domainName: string;
  permission: string;
}): Promise<DomainSummary> {
  return api<DomainSummary>("/api/domains", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function renameDomainApi(domainId: string, domainName: string): Promise<void> {
  return api<void>(`/api/domains/${encodeURIComponent(domainId)}`, {
    method: "PUT",
    body: JSON.stringify({ domainName }),
  });
}

export function updateDomainPermissionApi(domainId: string, permission: string): Promise<void> {
  return api<void>(`/api/domains/${encodeURIComponent(domainId)}/permission`, {
    method: "PUT",
    body: JSON.stringify({ permission }),
  });
}

export function deleteDomainApi(domainId: string): Promise<void> {
  return api<void>(`/api/domains/${encodeURIComponent(domainId)}`, {
    method: "DELETE",
  });
}

export function fetchDomainMembersApi(domainId: string): Promise<DomainMemberListEntry[]> {
  return api<{ members: DomainMemberListEntry[] }>(
    `/api/domains/${encodeURIComponent(domainId)}/members`,
  ).then((d) => d.members);
}

export function putDomainMembersApi(domainId: string, visitorIds: string[]): Promise<{ memberCount: number }> {
  return api<{ memberCount: number }>(`/api/domains/${encodeURIComponent(domainId)}/members`, {
    method: "PUT",
    body: JSON.stringify({ visitorIds }),
  });
}

export function fetchDomainMemberTemplatesApi(): Promise<DomainMemberTemplate[]> {
  return api<DomainMemberTemplate[]>("/api/domain-member-templates");
}

export function createDomainMemberTemplateApi(input: {
  displayName: string;
  visitorIds: string[];
}): Promise<DomainMemberTemplate> {
  return api<DomainMemberTemplate>("/api/domain-member-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDomainMemberTemplateApi(
  id: number,
  input: { displayName: string; visitorIds: string[] },
): Promise<DomainMemberTemplate> {
  return api<DomainMemberTemplate>(`/api/domain-member-templates/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteDomainMemberTemplateApi(id: number): Promise<void> {
  return api<void>(`/api/domain-member-templates/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

export function fetchTreeApi(domainId?: string): Promise<TreeNode[]> {
  const q = domainId?.trim() ? `?domainId=${encodeURIComponent(domainId.trim())}` : "";
  return api<TreeNode[]>(`/api/tree${q}`);
}

export function getDocumentApi(documentId: string): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/api/documents/${encodeURIComponent(documentId)}`);
}

export function createDocumentApi(input: {
  relativePath: string;
  displayName?: string;
  content: string;
  domainId?: string;
  permission?: number;
}): Promise<DocumentDetail> {
  return api<DocumentDetail>("/api/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDocumentApi(
  documentId: string,
  input: { content: string; displayName?: string; permission?: number },
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteDocumentApi(documentId: string): Promise<void> {
  return api<void>(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
}

export function getDocumentInvitesApi(documentId: string): Promise<{ visitorId: string; permission: string }[]> {
  return api<{ visitorId: string; permission: string }[]>(`/api/documents/${encodeURIComponent(documentId)}/invites`);
}

export function addDocumentInviteApi(
  documentId: string,
  targetVisitorId: string,
  targetPermission: string,
): Promise<void> {
  return api<void>(`/api/documents/${encodeURIComponent(documentId)}/invites`, {
    method: "POST",
    body: JSON.stringify({ targetVisitorId, targetPermission }),
  });
}

export function removeDocumentInviteApi(documentId: string, targetVisitorId: string): Promise<void> {
  return api<void>(`/api/documents/${encodeURIComponent(documentId)}/invites/${encodeURIComponent(targetVisitorId)}`, {
    method: "DELETE",
  });
}
