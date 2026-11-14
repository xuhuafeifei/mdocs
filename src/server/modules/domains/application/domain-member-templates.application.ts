import { getDb } from "../../../infra/db/connection.js";
import {
  deleteDomainMemberTemplate,
  findDomainMemberTemplateById,
  insertDomainMemberTemplate,
  listDomainMemberTemplates,
  normaliseVisitorIdsToCsv,
  updateDomainMemberTemplate,
  visitorIdsFromStoredCsv,
  type DomainMemberTemplateRow,
} from "../../../infra/db/repositories/domain-member-template.repo.js";
import { DomainError } from "../domain-error.js";

function rowToDto(row: DomainMemberTemplateRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    visitorIds: visitorIdsFromStoredCsv(row.domain_visitor_ids),
    createTime: row.create_time,
    updateTime: row.update_time,
  };
}

function parseTemplateId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new DomainError("BAD_REQUEST", "invalid id", 400);
  }
  return id;
}

export function listMemberTemplates(createVisitorId: string) {
  const rows = listDomainMemberTemplates(getDb(), createVisitorId);
  return rows.map(rowToDto);
}

export function createMemberTemplate(params: {
  createVisitorId: string;
  displayName: string;
  visitorIds?: string[];
}) {
  const displayName = params.displayName.trim();
  if (!displayName) {
    throw new DomainError("BAD_REQUEST", "displayName is required", 400);
  }
  const visitorIds = params.visitorIds ?? [];
  const now = new Date().toISOString();
  const db = getDb();
  const id = insertDomainMemberTemplate(db, {
    displayName,
    domainVisitorIdsCsv: normaliseVisitorIdsToCsv(visitorIds),
    createVisitorId: params.createVisitorId,
    createTime: now,
    updateTime: now,
  });
  const row = findDomainMemberTemplateById(db, id, params.createVisitorId);
  if (!row) {
    throw new DomainError("INTERNAL", "failed to load created template", 500);
  }
  return rowToDto(row);
}

export function updateMemberTemplate(params: {
  createVisitorId: string;
  idRaw: string;
  displayName: string;
  visitorIds?: string[];
}) {
  const id = parseTemplateId(params.idRaw);
  const displayName = params.displayName.trim();
  if (!displayName) {
    throw new DomainError("BAD_REQUEST", "displayName is required", 400);
  }
  const visitorIds = params.visitorIds ?? [];
  const db = getDb();
  const updated = updateDomainMemberTemplate(db, id, params.createVisitorId, {
    displayName,
    domainVisitorIdsCsv: normaliseVisitorIdsToCsv(visitorIds),
    updateTime: new Date().toISOString(),
  });
  if (!updated) {
    throw new DomainError("NOT_FOUND", "template not found", 404);
  }
  const row = findDomainMemberTemplateById(db, id, params.createVisitorId)!;
  return rowToDto(row);
}

export function deleteMemberTemplate(createVisitorId: string, idRaw: string): void {
  const id = parseTemplateId(idRaw);
  const deleted = deleteDomainMemberTemplate(getDb(), id, createVisitorId);
  if (!deleted) {
    throw new DomainError("NOT_FOUND", "template not found", 404);
  }
}
