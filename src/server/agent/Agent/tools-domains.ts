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

function asToolResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

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

export function createDomainTools(visitorId: string): AgentTool[] {
  return [
    {
      name: "list_domains",
      label: "列出可见域",
      description: "列出当前访客可见域（domainId/domainName/permission/docCount）",
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
    },
    {
      name: "create_domain",
      label: "创建域",
      description: "创建域（permission: public/restricted/private，默认 restricted）",
      parameters: Type.Object({
        domainName: Type.String({ description: "域名" }),
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
    },
    {
      name: "list_domain_members",
      label: "列出域成员",
      description:
        "列出 restricted 域的成员（仅域创建者可用）。返回 visitorId / visitorName / missing / disabled。",
      parameters: Type.Object({
        domainId: Type.String({ description: "域 ID" }),
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
    },
    {
      name: "add_domain_members",
      label: "添加域成员",
      description:
        "向 restricted 域追加成员（仅域创建者可用；不会清空现有成员）。visitorIds 来自「列出活跃访客」。创建者始终保留。",
      parameters: Type.Object({
        domainId: Type.String({ description: "域 ID" }),
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
    },
  ];
}
