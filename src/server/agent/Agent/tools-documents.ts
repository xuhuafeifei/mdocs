import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TreeNode } from "../../../shared/types/tree.js";
import { getDb } from "../../db/connection.js";
import { listDocumentsByVisitor } from "../../db/repositories/document.repo.js";
import { assertDocumentAccess, DocumentError } from "../../access/access-control.js";
import { createDocument, getDocument, moveDocument } from "../../documents/document.service.js";
import { buildDocumentTree } from "../../documents/tree.service.js";
import { createFolder } from "../../routes/folders.routes.js";
import { searchDocuments } from "../../search/search.service.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

/** Agent 上下文体积上限；超长正文截断并标注 */
const GET_DOCUMENT_MAX_CHARS = 50_000;

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

export function searchDocumentsTool({ visitorId }: ToolDeps): AgentTool {
  return {
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
  };
}

export function listTreeTool({ visitorId }: ToolDeps): AgentTool {
  return {
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
  };
}

export function listMyDocumentsTool({ visitorId }: ToolDeps): AgentTool {
  return {
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
  };
}

export function getDocumentTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "get_document",
    label: "读取文档内容",
    description:
      "按 documentId 读取当前访客有权阅读的文档正文。默认纯文本（从 Lexical 抽取）；format=json 返回 Lexical JSON。与 HTTP GET /api/documents/:id 同一套读权限，无额外特权。",
    parameters: Type.Object({
      documentId: Type.String({ description: "文档 documentId" }),
      format: Type.Optional(
        Type.Union([Type.Literal("text"), Type.Literal("json")], {
          description: "text（默认，纯文本）或 json（Lexical）",
        }),
      ),
    }),
    execute: async (_id, params) => {
      const { documentId: rawId, format: rawFormat } = params as {
        documentId: string;
        format?: "text" | "json";
      };
      const documentId = rawId?.trim();
      if (!documentId) throw new Error("documentId is required");
      const format = rawFormat === "json" ? "json" : "text";
      try {
        assertDocumentAccess(documentId, visitorId, "read");
        const doc = getDocument(documentId, visitorId, format);
        let content = doc.content ?? "";
        let contentTruncated = false;
        if (content.length > GET_DOCUMENT_MAX_CHARS) {
          content = content.slice(0, GET_DOCUMENT_MAX_CHARS);
          contentTruncated = true;
        }
        return asToolResult({
          documentId: doc.documentId,
          displayName: doc.displayName,
          domainId: doc.domainId,
          relativePath: doc.relativePath,
          permission: doc.permission,
          format,
          contentTruncated,
          ...(contentTruncated ? { contentMaxChars: GET_DOCUMENT_MAX_CHARS } : {}),
          content,
        });
      } catch (err) {
        if (err instanceof DocumentError) {
          throw new Error(`${err.code}: ${err.message}`);
        }
        throw err;
      }
    },
  };
}

export function createDocumentTool({ visitorId }: ToolDeps): AgentTool {
  return {
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
  };
}

export function createFolderTool({ visitorId }: ToolDeps): AgentTool {
  return {
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
  };
}

export function moveDocumentTool({ visitorId }: ToolDeps): AgentTool {
  return {
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
  };
}
