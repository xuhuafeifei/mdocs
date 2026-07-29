import { randomUUID } from "node:crypto";
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { resolveDomainAccess } from "../../access/domain-access.js";
import { getDb } from "../../db/connection.js";
import {
  addDomainMember,
  insertDomain,
  listDomains,
} from "../../db/repositories/domain.repo.js";
import {
  countDocumentsByDomain,
  listDomainIdsWithDocumentInviteForVisitor,
  listDocumentsByVisitor,
} from "../../db/repositories/document.repo.js";
import { createDocument } from "../../documents/document.service.js";
import { buildDocumentTree } from "../../documents/tree.service.js";
import { createFolder } from "../../routes/folders.routes.js";
import { searchDocuments } from "../../search/search.service.js";
import type { TreeNode } from "../../../shared/types/tree.js";

function asToolResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

type FlatTreeItem = {
  type: "folder" | "document";
  documentId: string;
  name: string;
  path: string;
  displayName?: string;
  updatedAt?: string;
};

function flattenTree(nodes: TreeNode[], limit = 80): FlatTreeItem[] {
  const items: FlatTreeItem[] = [];
  const walk = (nodeList: TreeNode[]) => {
    for (const n of nodeList) {
      if (items.length >= limit) return;
      if (n.type === "folder") {
        items.push({
          type: "folder",
          documentId: n.documentId,
          name: n.name,
          path: n.path,
          displayName: n.folderDisplayName ?? n.name,
        });
        walk(n.children);
      } else {
        items.push({
          type: "document",
          documentId: n.documentId,
          name: n.name,
          path: n.path,
          displayName: n.displayName,
          updatedAt: n.updatedAt,
        });
      }
    }
  };
  walk(nodes);
  return items;
}

export function createAccountTools(visitorId: string): AgentTool[] {
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
      name: "search_documents",
      label: "搜索文档",
      description: "全文搜索当前访客可读文档",
      parameters: Type.Object({
        query: Type.String({ description: "搜索词" }),
        domainId: Type.Optional(Type.String({ description: "域 ID，可选" })),
        topN: Type.Optional(Type.Number({ description: "返回条数，默认 10，最大 30" })),
      }),
      execute: async (_id, params) => {
        const { query, domainId, topN } = params as {
          query: string;
          domainId?: string;
          topN?: number;
        };
        const q = query?.trim();
        if (!q) throw new Error("query is required");
        const limit = Math.min(Math.max(Math.floor(topN ?? 10), 1), 30);
        const results = searchDocuments({
          query: q,
          visitorId,
          domainId: domainId?.trim() || undefined,
          topN: limit,
        });
        return asToolResult({ query: q, results });
      },
    },
    {
      name: "list_tree",
      label: "列出域树",
      description: "列出域内可见文档树（扁平，最多 80 项）",
      parameters: Type.Object({
        domainId: Type.Optional(Type.String({ description: "域 ID，可选" })),
      }),
      execute: async (_id, params) => {
        const domainId = (params as { domainId?: string }).domainId?.trim() || undefined;
        const items = flattenTree(buildDocumentTree(domainId, visitorId), 80);
        return asToolResult({
          domainId: domainId ?? null,
          truncated: items.length >= 80,
          items,
        });
      },
    },
    {
      name: "list_my_documents",
      label: "列出我创建的文档",
      description: "列出当前访客创建的文档（按更新时间倒序）",
      parameters: Type.Object({}),
      execute: async () => {
        const all = listDocumentsByVisitor(getDb(), visitorId);
        const documents = all.slice(0, 50);
        return asToolResult({
          total: all.length,
          truncated: all.length > 50,
          documents,
        });
      },
    },
    {
      name: "create_document",
      label: "创建空文档",
      description: "创建空 Markdown 文档（不写正文）",
      parameters: Type.Object({
        fileName: Type.String({ description: "文件名，可不带 .md" }),
        displayName: Type.Optional(Type.String({ description: "展示名，可选" })),
        domainId: Type.Optional(Type.String({ description: "域 ID，可选" })),
        parentId: Type.Optional(Type.String({ description: "父目录 documentId，可选" })),
      }),
      execute: async (_id, params) => {
        const { fileName, displayName, domainId, parentId } = params as {
          fileName: string;
          displayName?: string;
          domainId?: string;
          parentId?: string;
        };
        if (!fileName?.trim()) throw new Error("fileName is required");
        const doc = createDocument({
          actorVisitorId: visitorId,
          fileName: fileName.trim(),
          displayName: displayName?.trim() || undefined,
          content: "",
          contentFormat: "markdown",
          domainId: domainId?.trim() || undefined,
          parentId: parentId?.trim() || undefined,
        });
        return asToolResult({
          documentId: doc.documentId,
          domainId: doc.domainId,
          displayName: doc.displayName,
          relativePath: doc.relativePath,
          permission: doc.permission,
        });
      },
    },
    {
      name: "create_folder",
      label: "创建文件夹",
      description: "创建文件夹，可选传入 parentId/domainId/description",
      parameters: Type.Object({
        name: Type.String({ description: "文件夹名" }),
        domainId: Type.Optional(Type.String({ description: "域 ID，可选" })),
        parentId: Type.Optional(Type.String({ description: "父目录 documentId，可选" })),
        description: Type.Optional(Type.String({ description: "目录描述 Markdown，可选" })),
      }),
      execute: async (_id, params) => {
        const { name, domainId, parentId, description } = params as {
          name: string;
          domainId?: string;
          parentId?: string;
          description?: string;
        };
        if (!name?.trim()) throw new Error("name is required");
        const result = createFolder({
          actorVisitorId: visitorId,
          name: name.trim(),
          domainId: domainId?.trim() || undefined,
          parentId: parentId?.trim() || undefined,
          description: description?.trim() || undefined,
        });
        return asToolResult(result);
      },
    },
  ];
}
