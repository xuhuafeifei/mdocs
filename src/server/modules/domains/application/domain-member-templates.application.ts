import {
  deleteDomainMemberTemplate,
  findDomainMemberTemplateById,
  insertDomainMemberTemplate,
  listDomainMemberTemplates,
  updateDomainMemberTemplate,
} from "../repo/domain-member-template.repo.js";
import {
  toDomainMemberTemplateResponse,
  toDomainMemberTemplates,
  toDomainMemberTemplatesUpdate,
} from "../mapper/domain-member-template.mapper.js";
import type { DomainMemberTemplateResponse } from "../response/domain-member-template.response.js";
import { DomainError } from "../domain-error.js";

function parseTemplateId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new DomainError("BAD_REQUEST", "invalid id", 400);
  }
  return id;
}

export function listMemberTemplates(
  createVisitorId: string,
): DomainMemberTemplateResponse[] {
  return listDomainMemberTemplates(createVisitorId).map(toDomainMemberTemplateResponse);
}

export function createMemberTemplate(params: {
  createVisitorId: string;
  displayName: string;
  visitorIds?: string[];
}): DomainMemberTemplateResponse {
  const displayName = params.displayName.trim();
  if (!displayName) {
    throw new DomainError("BAD_REQUEST", "displayName is required", 400);
  }
  const now = new Date().toISOString();
  const row = toDomainMemberTemplates({
    displayName,
    visitorIds: params.visitorIds ?? [],
    createVisitorId: params.createVisitorId,
    createTime: now,
    updateTime: now,
  });
  const id = insertDomainMemberTemplate(row);
  const created = findDomainMemberTemplateById(id, params.createVisitorId);
  if (!created) {
    throw new DomainError("INTERNAL", "failed to load created template", 500);
  }
  return toDomainMemberTemplateResponse(created);
}

export function updateMemberTemplate(params: {
  createVisitorId: string;
  idRaw: string;
  displayName: string;
  visitorIds?: string[];
}): DomainMemberTemplateResponse {
  const id = parseTemplateId(params.idRaw);
  const displayName = params.displayName.trim();
  if (!displayName) {
    throw new DomainError("BAD_REQUEST", "displayName is required", 400);
  }
  const existing = findDomainMemberTemplateById(id, params.createVisitorId);
  if (!existing) {
    throw new DomainError("NOT_FOUND", "template not found", 404);
  }
  const next = toDomainMemberTemplatesUpdate(existing, {
    displayName,
    visitorIds: params.visitorIds ?? [],
    updateTime: new Date().toISOString(),
  });
  if (!updateDomainMemberTemplate(next)) {
    throw new DomainError("NOT_FOUND", "template not found", 404);
  }
  const updated = findDomainMemberTemplateById(id, params.createVisitorId)!;
  return toDomainMemberTemplateResponse(updated);
}

export function deleteMemberTemplate(createVisitorId: string, idRaw: string): void {
  const id = parseTemplateId(idRaw);
  const deleted = deleteDomainMemberTemplate(id, createVisitorId);
  if (!deleted) {
    throw new DomainError("NOT_FOUND", "template not found", 404);
  }
}
