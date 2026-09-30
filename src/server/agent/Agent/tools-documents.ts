import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TreeNode } from "../../../shared/types/tree.js";
import { getDb } from "../../db/connection.js";
import { listDocumentsByVisitor } from "../../db/repositories/document.repo.js";
import { assertDocumentAccess, DocumentError } from "../../access/access-control.js";
import { createDocument, addDocumentInvite, getDocument, moveDocument } from "../../documents/document.service.js";
import { buildDocumentTree } from "../../documents/tree.service.js";
import { createFolder } from "../../routes/folders.routes.js";
import { searchDocuments, tokenizeQuery, type SearchMode } from "../../search/search.service.js";
import { listEmbeddingIndex, rebuildEmbeddingIndex } from "../../search/embedding-admin.js";
import { isEmbeddingReady } from "../../search/embedding-model.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";
import { FILE_TYPE } from "../../../shared/file-types.js";
import { treeIncludeTypes } from "../../../shared/file-type-policy.js";

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
    description:
      "全文搜索当前访客可读文档（跨工作空间内容检索）。mode 控制检索路：auto（默认，关键词+语义混合）、keyword（仅关键词 FTS）、semantic（仅语义近邻，模型未就绪返回空）。要按「我创建的文章」筛选/翻页请用 query_my_documents。",
    parameters: Type.Object({
      query: Type.String({ description: "搜索词" }),
      mode: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("keyword"), Type.Literal("semantic")], {
          description: "检索模式，默认 auto；语义命中可补关键词盲区",
        }),
      ),
      domainId: Type.Optional(Type.String({ description: "工作空间 ID，可选" })),
      topN: Type.Optional(Type.Number({ description: "返回条数，默认 10，最大 30" })),
    }),
    execute: async (_id, params) => {
      const { query, mode, domainId, topN } = params as {
        query: string;
        mode?: SearchMode;
        domainId?: string;
        topN?: number;
      };
      const q = query?.trim();
      if (!q) throw new Error("query is required");
      const limit = Math.min(Math.max(Math.floor(topN ?? 10), 1), 30);
      const results = await searchDocuments({
        query: q,
        visitorId,
        domainId: domainId?.trim() || undefined,
        topN: limit,
        mode,
      });
      return asToolResult({
        query: q,
        mode: mode ?? "auto",
        modelReady: isEmbeddingReady(),
        tokens: tokenizeQuery(q),
        results,
      });
    },
  };
}

/** 语义索引状态：哪些可读文档已建/未建向量块 */
export function listSemanticIndexTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "list_semantic_index",
    label: "查语义索引状态",
    description:
      "列出当前访客可读 md 文档的语义索引状态（chunk 数、上次构建时间），用于判断哪些文档还没建语义索引。modelReady=false 表示语义模型未就绪。",
    parameters: Type.Object({
      domainId: Type.Optional(Type.String({ description: "工作空间 ID，可选" })),
    }),
    execute: async (_id, params) => {
      const domainId = (params as { domainId?: string }).domainId?.trim() || undefined;
      const data = listEmbeddingIndex({ visitorId, domainId });
      return asToolResult(data);
    },
  };
}

/** 语义索引构建：可读即可索引，不可读 skipped */
export function rebuildSemanticIndexTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "rebuild_semantic_index",
    label: "重建语义索引",
    description:
      "对指定文档尽力重建语义向量索引（模型未就绪则全部 failed）。权限与读取一致：可读即可索引，无读权限的文档进 skipped。最多 100 篇。",
    parameters: Type.Object({
      documentIds: Type.Array(Type.String(), {
        description: "要重建的 documentId 列表（最多 100）",
      }),
    }),
    execute: async (_id, params) => {
      const { documentIds } = params as { documentIds?: unknown };
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        throw new Error("documentIds (non-empty string[]) is required");
      }
      const data = await rebuildEmbeddingIndex({
        visitorId,
        documentIds: documentIds as string[],
      });
      return asToolResult(data);
    },
  };
}

export function listTreeTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "list_tree",
    label: "列出目录",
    description: "列出工作空间内可见文档树（扁平，最多 80 项）",
    parameters: Type.Object({
      domainId: Type.Optional(Type.String({ description: "工作空间 ID，可选" })),
    }),
    execute: async (_id, params) => {
      const domainId = (params as { domainId?: string }).domainId?.trim() || undefined;
      const items = flattenTree(buildDocumentTree(domainId, visitorId, { includeTypes: treeIncludeTypes() }), 80);
      return asToolResult({
        domainId: domainId ?? null,
        truncated: items.length >= 80,
        items,
      });
    },
  };
}

export function queryMyDocumentsTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "query_my_documents",
    label: "查询我的文章",
    description:
      "列出当前访客创建的文档（与设置页「我的文章」同一接口）。可按 domainId、creatorVisitorId 筛选，按 domain/creator 分组；用 offset/limit 翻页。要全文检索可读文档请用 search_documents。",
    parameters: Type.Object({
      domainId: Type.Optional(Type.String({ description: "只看该工作空间，不传则全部" })),
      creatorVisitorId: Type.Optional(
        Type.String({ description: "只看该创建者。本工具已限定为当前访客创建的文档，筛他人通常为空" }),
      ),
      groupBy: Type.Optional(
        Type.Union([Type.Literal("domain"), Type.Literal("creator")], {
          description: "按工作空间或创建者分组（仅当前页），不传则平铺",
        }),
      ),
      offset: Type.Optional(Type.Number({ description: "分页偏移，默认 0" })),
      limit: Type.Optional(Type.Number({ description: "每页条数，默认 20，最大 100" })),
    }),
    execute: async (_id, params) => {
      const { domainId, creatorVisitorId, groupBy, offset, limit } = params as {
        domainId?: string;
        creatorVisitorId?: string;
        groupBy?: "domain" | "creator";
        offset?: number;
        limit?: number;
      };
      const result = listDocumentsByVisitor(getDb(), visitorId, {
        offset: Math.max(Math.floor(offset ?? 0), 0),
        limit: Math.min(Math.max(Math.floor(limit ?? 20), 1), 100),
        domainId,
        creatorVisitorId,
        groupBy,
      });
      return asToolResult({
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.offset + result.items.length < result.total,
        documents: result.items,
        ...(result.groups ? { groups: result.groups } : {}),
      });
    },
  };
}

export function getDocumentTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "get_document",
    label: "读取文档内容",
    description:
      "按 documentId 读取当前访客有权阅读的文档正文。响应含 fileType。默认 format=text：md 从 Lexical 抽纯文本，html 为 HTML 原文；format=json 返回存盘原文。与 HTTP GET /api/documents/:id 同一套读权限，无额外特权。",
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
          fileType: doc.fileType,
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
    description:
      "创建空文档（不写正文）。默认 fileType=md（Markdown）。创建 HTML 文档必须传 fileType=html，或 fileName 以 .html 结尾；创建后若要写正文，再调用 overwrite_document。",
    parameters: Type.Object({
      fileName: Type.String({
        description: "文件名；Markdown 可不带后缀，HTML 建议 untitled.html 或传 fileType=html",
      }),
      displayName: Type.Optional(Type.String({ description: "展示名，可选" })),
      domainId: Type.Optional(Type.String({ description: "工作空间 ID，可选" })),
      parentId: Type.Optional(Type.String({ description: "父目录 documentId，可选" })),
      fileType: Type.Optional(
        Type.Union([Type.Literal("md"), Type.Literal("html")], {
          description: "md=Markdown（默认）；html=HTML 文档",
        }),
      ),
    }),
    execute: async (_id, params) => {
      const { fileName, displayName, domainId, parentId, fileType } = params as {
        fileName: string;
        displayName?: string;
        domainId?: string;
        parentId?: string;
        fileType?: string;
      };
      if (!fileName?.trim()) throw new Error("fileName is required");
      const kind =
        fileType === "html" || /\.html$/i.test(fileName.trim())
          ? FILE_TYPE.HTML
          : FILE_TYPE.DOCUMENT;
      const doc = createDocument({
        actorVisitorId: visitorId,
        fileName: fileName.trim(),
        displayName: displayName?.trim() || undefined,
        content: "",
        ...(kind === FILE_TYPE.HTML
          ? { fileType: FILE_TYPE.HTML }
          : { contentFormat: "markdown" as const }),
        domainId: domainId?.trim() || undefined,
        parentId: parentId?.trim() || undefined,
      });
      return asToolResult({
        documentId: doc.documentId,
        domainId: doc.domainId,
        displayName: doc.displayName,
        relativePath: doc.relativePath,
        permission: doc.permission,
        fileType: doc.fileType,
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
      domainId: Type.Optional(Type.String({ description: "工作空间 ID，可选" })),
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
      "将文档移到同一工作空间的另一文件夹，或移到工作空间根目录。仅文档创建者可成功。parentId 为文件夹 documentId；不传或传 null 表示移到根目录。目标路径已有同名文件会失败。不移动文件夹。",
    parameters: Type.Object({
      documentId: Type.String({ description: "要移动的文档 documentId" }),
      parentId: Type.Optional(
        Type.String({ description: "目标文件夹 documentId；不传则移到工作空间根目录" }),
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

export function inviteDocumentUserTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "invite_document_user",
    label: "邀请用户看文档",
    description:
      "给一篇文档发邀请。仅文档创建者。permission 为 read 或 edit，不传则 read。工作空间成员不能再被邀请（与成员互斥）。先用「列出活跃访客」拿 visitorId。",
    parameters: Type.Object({
      documentId: Type.String({ description: "文档 ID" }),
      targetVisitorId: Type.String({ description: "被邀请访客 ID" }),
      permission: Type.Optional(Type.String({ description: "read | edit，默认 read" })),
    }),
    execute: async (_id, params) => {
      const { documentId: rawDoc, targetVisitorId: rawTarget, permission } = params as {
        documentId: string;
        targetVisitorId: string;
        permission?: string;
      };
      const documentId = rawDoc?.trim();
      const targetVisitorId = rawTarget?.trim();
      if (!documentId) throw new Error("documentId is required");
      if (!targetVisitorId) throw new Error("targetVisitorId is required");
      const targetPermission = permission?.trim() || "read";
      if (targetPermission !== "read" && targetPermission !== "edit") {
        throw new Error("permission must be read or edit");
      }
      try {
        addDocumentInvite(visitorId, documentId, targetVisitorId, targetPermission);
        return asToolResult({ documentId, targetVisitorId, permission: targetPermission });
      } catch (err) {
        if (err instanceof DocumentError) throw new Error(`${err.code}: ${err.message}`);
        throw err;
      }
    },
  };
}
