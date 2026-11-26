import { randomUUID } from "node:crypto";
import { getDb } from "../../../infra/db/connection.js";
import {
  addDomainMember,
  deleteDomainRow,
  findDomainById,
  insertDomain,
  listDomainMembers,
  listDomains,
  replaceDomainMembers,
  updateDomainName,
  type DomainMemberRole,
} from "../repo/domain.repo.js";
import { countDocumentsByDomain } from "../../documents/service/document.service.js";
import { findVisitorById } from "../../visitor/repo/visitor.repo.js";
import { canEnterDomains } from "../../access/access.js";
import {
  changeDomainPermission,
  DomainPermissionError,
} from "../change-domain-permission.js";
import { DomainError } from "../domain-error.js";

function parseMemberRole(raw: unknown): DomainMemberRole | null {
  if (raw === "read" || raw === "write") return raw;
  return null;
}

function normaliseVisitorIdsBody(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const v = (body as { visitorIds?: unknown }).visitorIds;
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== "string") return null;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 优先 `members`；兼容旧 `visitorIds`（全 read） */
function normaliseMembersBody(
  body: unknown,
): Array<{ visitorId: string; role: DomainMemberRole }> | null {
  if (!body || typeof body !== "object") return null;
  const membersRaw = (body as { members?: unknown }).members;
  if (Array.isArray(membersRaw)) {
    const out: Array<{ visitorId: string; role: DomainMemberRole }> = [];
    const seen = new Set<string>();
    for (const item of membersRaw) {
      if (!item || typeof item !== "object") return null;
      const visitorId =
        typeof (item as { visitorId?: unknown }).visitorId === "string"
          ? (item as { visitorId: string }).visitorId.trim()
          : "";
      if (!visitorId || seen.has(visitorId)) continue;
      const role = parseMemberRole((item as { role?: unknown }).role) ?? "read";
      seen.add(visitorId);
      out.push({ visitorId, role });
    }
    return out;
  }
  const ids = normaliseVisitorIdsBody(body);
  if (ids === null) return null;
  return ids.map((visitorId) => ({ visitorId, role: "read" as const }));
}

export function listVisibleDomains(visitorId: string | null) {
  const rows = listDomains();
  const visible = canEnterDomains(
    visitorId,
    rows.map((r) => r.domain_id),
  );
  return rows
    .filter((r) => visible.has(r.domain_id))
    .map((r) => ({
      domainId: r.domain_id,
      domainName: r.domain_name,
      permission: r.permission,
      creatorVisitorId: r.creator_visitor_id,
      docCount: countDocumentsByDomain(r.domain_id),
    }));
}

export function createDomain(params: {
  actorVisitorId: string;
  domainName: string;
  permission?: string;
}) {
  const domainName = params.domainName.trim();
  if (!domainName) {
    throw new DomainError("BAD_REQUEST", "domainName is required", 400);
  }
  const permission = params.permission ?? "restricted";
  if (!["public", "restricted", "private"].includes(permission)) {
    throw new DomainError("BAD_REQUEST", "invalid permission", 400);
  }

  const now = new Date().toISOString();
  const domainId = randomUUID();
  const db = getDb();

  const existing = db
    .prepare(`SELECT domain_id FROM domains WHERE domain_name = ?`)
    .get(domainName);
  if (existing) {
    throw new DomainError("DOMAIN_NAME_EXISTS", "domain name already exists", 409);
  }

  insertDomain({
    domain_id: domainId,
    domain_name: domainName,
    creator_visitor_id: params.actorVisitorId,
    created_at: now,
    updated_at: now,
    permission,
  }, db);
  if (permission === "restricted") {
    addDomainMember(
      {
        domain_id: domainId,
        visitor_id: params.actorVisitorId,
        joined_at: now,
        role: "write",
      },
      db,
    );
  }

  return {
    domainId,
    domainName,
    permission,
    creatorVisitorId: params.actorVisitorId,
    docCount: 0,
  };
}

export function listDomainMembersForCreator(actorVisitorId: string, domainId: string) {
  const db = getDb();
  const domain = findDomainById(domainId, db);
  if (!domain) throw new DomainError("NOT_FOUND", "domain not found", 404);
  if (domain.creator_visitor_id !== actorVisitorId) {
    throw new DomainError("FORBIDDEN", "only the creator can view domain members", 403);
  }
  if (domain.permission !== "restricted") {
    throw new DomainError(
      "DOMAIN_NOT_RESTRICTED",
      "member list applies to restricted domains only",
      400,
    );
  }

  const rows = listDomainMembers(domainId, db);
  const members: {
    visitorId: string;
    visitorName: string;
    missing: boolean;
    disabled: boolean;
    role: DomainMemberRole;
  }[] = [];
  for (const row of rows) {
    const role: DomainMemberRole = row.role === "write" ? "write" : "read";
    const v = findVisitorById(row.visitor_id);
    if (!v) {
      members.push({
        visitorId: row.visitor_id,
        visitorName: "",
        missing: true,
        disabled: false,
        role,
      });
    } else {
      members.push({
        visitorId: row.visitor_id,
        visitorName: v.visitor_name,
        missing: false,
        disabled: v.disabled_at != null,
        role,
      });
    }
  }
  return { members };
}

export function replaceDomainMembersForCreator(
  actorVisitorId: string,
  domainId: string,
  body: unknown,
) {
  const parsed = normaliseMembersBody(body);
  if (parsed === null) {
    throw new DomainError(
      "BAD_REQUEST",
      "members must be an array of { visitorId, role }, or visitorIds string[]",
      400,
    );
  }

  const db = getDb();
  const domain = findDomainById(domainId, db);
  if (!domain) throw new DomainError("NOT_FOUND", "domain not found", 404);
  if (domain.creator_visitor_id !== actorVisitorId) {
    throw new DomainError("FORBIDDEN", "only the creator can modify domain members", 403);
  }
  if (domain.permission !== "restricted") {
    throw new DomainError(
      "DOMAIN_NOT_RESTRICTED",
      "member list applies to restricted domains only",
      400,
    );
  }

  const byId = new Map(parsed.map((m) => [m.visitorId, m.role]));
  byId.set(domain.creator_visitor_id, "write");
  const joinedAt = new Date().toISOString();
  const merged = [...byId.entries()].map(([visitorId, role]) => ({
    domain_id: domainId,
    visitor_id: visitorId,
    joined_at: joinedAt,
    role,
  }));

  const invalid: string[] = [];
  for (const m of merged) {
    if (!findVisitorById(m.visitor_id)) invalid.push(m.visitor_id);
  }
  if (invalid.length > 0) {
    throw new DomainError(
      "UNKNOWN_VISITOR_IDS",
      "one or more visitor ids do not exist",
      400,
      { invalidVisitorIds: invalid },
    );
  }

  replaceDomainMembers(domainId, merged, db);
  return { memberCount: merged.length };
}

export function renameDomain(params: {
  actorVisitorId: string;
  domainId: string;
  domainName: string;
}) {
  const domainName = params.domainName.trim();
  if (!domainName) {
    throw new DomainError("BAD_REQUEST", "domainName is required", 400);
  }
  const db = getDb();
  const domain = findDomainById(params.domainId, db);
  if (!domain) throw new DomainError("NOT_FOUND", "domain not found", 404);
  if (domain.creator_visitor_id !== params.actorVisitorId) {
    throw new DomainError("FORBIDDEN", "only the creator can modify this domain", 403);
  }
  if (countDocumentsByDomain(params.domainId) > 0) {
    throw new DomainError(
      "DOMAIN_HAS_DOCUMENTS",
      "cannot modify domain with documents",
      400,
    );
  }
  const existing = db
    .prepare(`SELECT domain_id FROM domains WHERE domain_name = ? AND domain_id != ?`)
    .get(domainName, params.domainId);
  if (existing) {
    throw new DomainError("DOMAIN_NAME_EXISTS", "domain name already exists", 409);
  }
  updateDomainName(params.domainId, domainName, db);
  return { domainId: params.domainId, domainName };
}

export function updateDomainPermission(
  actorVisitorId: string,
  domainId: string,
  permission: string,
) {
  try {
    return changeDomainPermission(actorVisitorId, domainId, permission);
  } catch (err) {
    if (err instanceof DomainPermissionError) {
      throw new DomainError(err.code, err.message, err.status);
    }
    throw err;
  }
}

export function deleteDomain(actorVisitorId: string, domainId: string): void {
  const db = getDb();
  const domain = findDomainById(domainId, db);
  if (!domain) throw new DomainError("NOT_FOUND", "domain not found", 404);
  if (domain.creator_visitor_id !== actorVisitorId) {
    throw new DomainError("FORBIDDEN", "only the creator can delete this domain", 403);
  }
  if (countDocumentsByDomain(domainId) > 0) {
    throw new DomainError(
      "DOMAIN_HAS_DOCUMENTS",
      "cannot delete domain with documents",
      400,
    );
  }
  deleteDomainRow(domainId, db);
}
