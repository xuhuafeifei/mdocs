import { randomUUID } from "node:crypto";
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { resolveDomainAccess } from "../../access/domain-access.js";
import { getDb } from "../../db/connection.js";
import {
  addDomainMember,
  findDomainById,
  insertDomain,
  listDomainMemberIds,
  listDomains,
} from "../../db/repositories/domain.repo.js";
import {
  countDocumentsByDomain,
  listDomainIdsWithDocumentInviteForVisitor,
} from "../../db/repositories/document.repo.js";
import { findVisitorById } from "../../db/repositories/visitor.repo.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";
import { changeDomainPermission, DomainPermissionError } from "../../domains/change-domain-permission.js";

/** 校验：域存在、restricted、且当前访客是创建者 */
function requireRestrictedDomainAsCreator(domainId: string, actorVisitorId: string) {
  const db = getDb();
  const domain = findDomainById(db, domainId);
  if (!domain) throw new Error("domain not found");
  if (domain.creator_visitor_id !== actorVisitorId) {
    throw new Error("only the creator can manage domain members");
  }
  if (domain.permission !== "restricted") {
    throw new Error("member list applies to restricted domains only");
  }
  return { db, domain };
}

export function listDomainsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "list_domains",
    label: "列出可见工作空间",
    description: "列出当前访客可见工作空间（domainId/domainName/permission/docCount）",
    parameters: Type.Object({}),
    execute: async () => {
      const db = getDb();
      const rows = listDomains(db);
      const invitedDomainIds = new Set(
        listDomainIdsWithDocumentInviteForVisitor(db, visitorId),
      );
      const domains = rows
        .filter(
          (r) =>
            resolveDomainAccess(db, r, r.domain_id, visitorId, {
              documentInviteDomainIds: invitedDomainIds,
            }).kind !== "none",
        )
        .map((r) => ({
          domainId: r.domain_id,
          domainName: r.domain_name,
          permission: r.permission,
          creatorVisitorId: r.creator_visitor_id,
          docCount: countDocumentsByDomain(db, r.domain_id),
        }));
      return asToolResult({ domains });
    },
  };
}

export function createDomainTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "create_domain",
    label: "创建工作空间",
    description: "创建工作空间（permission: public/restricted/private，默认 restricted）",
    parameters: Type.Object({
      domainName: Type.String({ description: "工作空间名称" }),
      permission: Type.Optional(
        Type.String({ description: "public | restricted | private" }),
      ),
    }),
    execute: async (_id, params) => {
      const { domainName, permission: rawPermission } = params as {
        domainName: string;
        permission?: string;
      };
      const name = domainName?.trim();
      if (!name) throw new Error("domainName is required");
      const permission = rawPermission?.trim() || "restricted";
      if (!["public", "restricted", "private"].includes(permission)) {
        throw new Error("invalid permission");
      }

      const db = getDb();
      const existing = db
        .prepare(`SELECT domain_id FROM domains WHERE domain_name = ?`)
        .get(name);
      if (existing) throw new Error("domain name already exists");

      const now = new Date().toISOString();
      const domainId = randomUUID();
      insertDomain(db, {
        domainId,
        domainName: name,
        creatorVisitorId: visitorId,
        createdAt: now,
        updatedAt: now,
        permission,
      });
      if (permission === "restricted") {
        addDomainMember(db, domainId, visitorId);
      }
      return asToolResult({
        domainId,
        domainName: name,
        permission,
        creatorVisitorId: visitorId,
        docCount: 0,
      });
    },
  };
}

export function listDomainMembersTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "list_domain_members",
    label: "列出工作空间成员",
    description:
      "列出 restricted 工作空间的成员（仅创建者可用）。返回 visitorId / visitorName / missing / disabled。",
    parameters: Type.Object({
      domainId: Type.String({ description: "工作空间 ID" }),
    }),
    execute: async (_id, params) => {
      const domainId = (params as { domainId: string }).domainId?.trim();
      if (!domainId) throw new Error("domainId is required");
      const { db, domain } = requireRestrictedDomainAsCreator(domainId, visitorId);
      const ids = listDomainMemberIds(db, domainId);
      const members = ids.map((id) => {
        const v = findVisitorById(db, id);
        if (!v) {
          return { visitorId: id, visitorName: "", missing: true, disabled: false };
        }
        return {
          visitorId: id,
          visitorName: v.visitor_name,
          missing: false,
          disabled: v.disabled_at != null,
        };
      });
      return asToolResult({
        domainId,
        domainName: domain.domain_name,
        memberCount: members.length,
        members,
      });
    },
  };
}

export function addDomainMembersTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "add_domain_members",
    label: "添加工作空间成员",
    description:
      "向 restricted 工作空间追加成员（仅创建者可用；不会清空现有成员）。visitorIds 来自「列出活跃访客」。创建者始终保留。",
    parameters: Type.Object({
      domainId: Type.String({ description: "工作空间 ID" }),
      visitorIds: Type.Array(Type.String({ description: "要添加的访客 ID" }), {
        description: "访客 ID 数组",
      }),
    }),
    execute: async (_id, params) => {
      const { domainId: rawDomainId, visitorIds } = params as {
        domainId: string;
        visitorIds: string[];
      };
      const domainId = rawDomainId?.trim();
      if (!domainId) throw new Error("domainId is required");
      if (!Array.isArray(visitorIds) || visitorIds.length === 0) {
        throw new Error("visitorIds must be a non-empty array");
      }

      const { db, domain } = requireRestrictedDomainAsCreator(domainId, visitorId);
      const uniqueIds = [...new Set(visitorIds.map((id) => id.trim()).filter(Boolean))];
      if (uniqueIds.length === 0) throw new Error("visitorIds must be a non-empty array");

      const invalid: string[] = [];
      const added: { visitorId: string; visitorName: string }[] = [];
      const alreadyMember: string[] = [];
      const before = new Set(listDomainMemberIds(db, domainId));

      for (const vid of uniqueIds) {
        const v = findVisitorById(db, vid);
        if (!v) {
          invalid.push(vid);
          continue;
        }
        if (before.has(vid)) {
          alreadyMember.push(vid);
          continue;
        }
        addDomainMember(db, domainId, vid);
        added.push({ visitorId: vid, visitorName: v.visitor_name });
      }

      if (invalid.length > 0 && added.length === 0) {
        throw new Error(`unknown visitor ids: ${invalid.join(", ")}`);
      }

      addDomainMember(db, domainId, domain.creator_visitor_id);

      return asToolResult({
        domainId,
        domainName: domain.domain_name,
        added,
        alreadyMember,
        invalidVisitorIds: invalid,
        memberCount: listDomainMemberIds(db, domainId).length,
      });
    },
  };
}

export function setDomainPermissionTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "set_domain_permission",
    label: "升级工作空间权限",
    description:
      "修改工作空间权限，只能升级不能下降：private → restricted → public。仅创建者。已有文档仍可升级。相同值视为成功、不改库。",
    parameters: Type.Object({
      domainId: Type.String({ description: "工作空间 ID" }),
      permission: Type.String({ description: "public | restricted | private" }),
    }),
    execute: async (_id, params) => {
      const { domainId: rawId, permission } = params as { domainId: string; permission: string };
      const domainId = rawId?.trim();
      if (!domainId) throw new Error("domainId is required");
      if (!permission?.trim()) throw new Error("permission is required");
      try {
        return asToolResult(changeDomainPermission(visitorId, domainId, permission.trim()));
      } catch (err) {
        if (err instanceof DomainPermissionError) throw new Error(`${err.code}: ${err.message}`);
        throw err;
      }
    },
  };
}
