import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TreeNode } from "../../../shared/types/tree.js";
import { getDb } from "../../db/connection.js";
import { listDocumentsByVisitor } from "../../db/repositories/document.repo.js";
import { createDocument, moveDocument } from "../../documents/document.service.js";
import { buildDocumentTree } from "../../documents/tree.service.js";
import { createFolder } from "../../routes/folders.routes.js";
import { searchDocuments } from "../../search/search.service.js";
import { DocumentError } from "../../access/access-control.js";

function asToolResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function flattenTree(nodes: TreeNode[], limit = 80) {
  const items: {
    type: "folder" | "document";
    documentId: string;
    name: string;
    path: string;
    displayName?: string;
    updatedAt?: string;
  }[] = [];
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

export function createDocumentTools(visitorId: string): AgentTool[] {
  return [
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
    {
      name: "move_document",
      label: "移动文档",
      description:
        "将文档移到同域另一文件夹，或移到域根。仅文档创建者可成功。parentId 为文件夹 documentId；不传或传 null 表示移到域根。目标路径已有同名文件会失败。不移动文件夹。",
      parameters: Type.Object({
        documentId: Type.String({ description: "要移动的文档 documentId" }),
        parentId: Type.Optional(
          Type.String({ description: "目标文件夹 documentId；不传则移到域根" }),
        ),
      }),
      execute: async (_id, params) => {
        const { documentId: rawId, parentId: rawParent } = params as {
          documentId: string;
          parentId?: string;
        };
        const documentId = rawId?.trim();
        if (!documentId) throw new Error("documentId is required");
        const parentId = rawParent?.trim() ? rawParent.trim() : null;
        try {
          const doc = moveDocument({
            actorVisitorId: visitorId,
            documentId,
            parentId,
          });
          return asToolResult({
            documentId: doc.documentId,
            domainId: doc.domainId,
            parentId: doc.parentId,
            relativePath: doc.relativePath,
            displayName: doc.displayName,
          });
        } catch (err) {
          if (err instanceof DocumentError) {
            throw new Error(`${err.code}: ${err.message}`);
          }
          throw err;
        }
      },
    },
  ];
}
