import { api } from "./client";
import type { DocumentDetail } from "../../shared/types/document";
import type {
  VisitorMeResponse,
  VisitorPublic,
  VisitorRegisterResponse,
} from "../../shared/types/visitor";
import type { TreeNode } from "../../shared/types/tree";
import type { DomainSummary } from "../../shared/types/domain";

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

export function fetchDomainsApi(): Promise<DomainSummary[]> {
  return api<DomainSummary[]>("/api/domains");
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
}): Promise<DocumentDetail> {
  return api<DocumentDetail>("/api/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDocumentApi(
  documentId: string,
  input: { content: string; displayName?: string },
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

