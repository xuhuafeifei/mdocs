import { getDb } from "../db/connection.js";
import {
  findChildrenByParent,
  findDocumentById,
  listDocumentsByDomain,
  type DocumentRow,
} from "../db/repositories/document.repo.js";
import { findDomainById, isDomainMember } from "../db/repositories/domain.repo.js";
import { resolveDomainAccess, canEnterDomainTree } from "../access/domain-access.js";
import { canReadDocument, DocumentError, type DomainAccessInfo } from "../access/access-control.js";
import { getConfig } from "../config/index.js";
import { FOLDER_DESC_FILENAME } from "../../shared/folderDesc.js";
import { getPolicy } from "../../shared/file-type-policy.js";
import type { FileType } from "../../shared/file-types.js";
import type {
  FolderSubtreeNode,
  TreeFolderNode,
  TreeNode,
} from "../../shared/types/tree.js";

export type { FolderSubtreeNode };

/**
 * 构建指定域的文档目录树。
 */
export function buildDocumentTree(
  domainId?: string,
  visitorId?: string | null,
  options?: { includeTypes?: string[] },
): TreeNode[] {
  const cfg = getConfig();
  const effective = domainId?.trim() || cfg.defaultDomainId;
  const db = getDb();

  const domain = findDomainById(db, effective);
  const access = resolveDomainAccess(db, domain, effective, visitorId);
  if (!canEnterDomainTree(access)) return [];

  const domainPermission = domain?.permission ?? "public";
  const isMember = !!(
    visitorId && domain && isDomainMember(db, domain.domain_id, visitorId)
  );
  const domainInfo: DomainAccessInfo = { domainPermission, isDomainMember: isMember };

  const rows = listDocumentsByDomain(db, effective);
  const filtered = rows.filter((r) => canReadDocument(r, visitorId ?? null, domainInfo));

  const typedRows = options?.includeTypes
    ? filtered.filter((r) => options.includeTypes!.includes(r.file_type))
    : filtered;

  return buildTreeFromRows(typedRows, visitorId ?? null);
}

/**
 * 按目录 document_id 构建精简子树（不含自身）。
 * - 不存在 → 404
 * - 非目录 → 400
 * - 域不可进 / 无读权限 → []
 */
export function buildFolderSubtree(
  folderId: string,
  visitorId?: string | null,
  options?: { includeTypes?: string[] },
): FolderSubtreeNode[] {
  const db = getDb();
  const folder = findDocumentById(db, folderId);
  if (!folder) {
    throw new DocumentError("DOC_NOT_FOUND", "目录不存在", 404);
  }
  if (folder.file_type !== "dir") {
    throw new DocumentError("BAD_REQUEST", "不是目录", 400);
  }

  const domain = findDomainById(db, folder.domain_id);
  const access = resolveDomainAccess(db, domain, folder.domain_id, visitorId);
  if (!canEnterDomainTree(access)) return [];

  const domainPermission = domain?.permission ?? "public";
  const isMember = !!(
    visitorId && domain && isDomainMember(db, domain.domain_id, visitorId)
  );
  const domainInfo: DomainAccessInfo = { domainPermission, isDomainMember: isMember };

  if (!canReadDocument(folder, visitorId ?? null, domainInfo)) {
    return [];
  }

  const descendantRows = collectDescendants(folderId);
  const filtered = descendantRows.filter((r) =>
    canReadDocument(r, visitorId ?? null, domainInfo),
  );

  const typedRows = options?.includeTypes
    ? filtered.filter((r) => options.includeTypes!.includes(r.file_type))
    : filtered;

  const full = buildTreeFromRows(typedRows, visitorId ?? null);
  return projectSubtree(full);
}

function collectDescendants(folderId: string): DocumentRow[] {
  const db = getDb();
  const out: DocumentRow[] = [];
  const queue = [...findChildrenByParent(db, folderId)];
  while (queue.length > 0) {
    const row = queue.shift()!;
    out.push(row);
    if (row.file_type === "dir") {
      queue.push(...findChildrenByParent(db, row.document_id));
    }
  }
  return out;
}

function projectSubtree(nodes: TreeNode[]): FolderSubtreeNode[] {
  return nodes.map((n) => {
    if (n.type === "folder") {
      return {
        type: "folder" as const,
        id: n.documentId,
        title: (n.folderDisplayName ?? n.name).trim() || n.name,
        children: projectSubtree(n.children),
      };
    }
    const title = n.displayName.trim() || n.name.replace(/\.md$/i, "") || n.name;
    return {
      type: "document" as const,
      id: n.documentId,
      title,
    };
  });
}

/**
 * 根据过滤后的文档行数组，按 parent_id 构建文档树。
 *
 * 路径处理：如果文档在访客自己的个人域下，自动去掉 `_personal/{visitorId}/` 前缀，
 * 让前端显示更简洁。
 *
 * 步骤：
 * 1. 为所有 dir 创建文件夹节点，document_id → TreeFolderNode 映射
 * 2. 处理文章叶子：folder_desc 挂到父文件夹；md/html 等 treeVisible 类型挂到树上
 * 3. 将文件夹挂在各自的父文件夹下
 * 4. 对根节点和子节点递归排序
 */
function buildTreeFromRows(rows: DocumentRow[], visitorId: string | null): TreeNode[] {
  const roots: TreeNode[] = [];
  const folderById = new Map<string, TreeFolderNode>();
  // 记录已添加到 roots 的文件夹 ID，避免重复
  const addedToRoots = new Set<string>();

  // 根据访问者身份处理路径：个人域下的路径去掉前缀
  const adjustPath = (path: string, ownerId: string): string => {
    if (!visitorId || ownerId !== visitorId) return path;
    const prefix = `_personal/${visitorId}/`;
    if (path.startsWith(prefix)) return path.slice(prefix.length);
    return path;
  };

  // 第一步：创建所有文件夹节点
  for (const row of rows) {
    if (row.file_type === "dir") {
      const node: TreeFolderNode = {
        type: "folder",
        name: deriveFolderName(row),
        path: adjustPath(row.relative_path, row.owner_visitor_id),
        documentId: row.document_id,
        children: [],
      };
      folderById.set(row.document_id, node);
    }
  }

  // 第二步：将文件夹挂在父节点或根级
  for (const row of rows) {
    if (row.file_type !== "dir") continue;
    const node = folderById.get(row.document_id)!;
    if (row.parent_id) {
      const parent = folderById.get(row.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
        addedToRoots.add(row.document_id);
      }
    } else {
      roots.push(node);
      addedToRoots.add(row.document_id);
    }
  }

  // 第三步：处理叶子（md / html / folder_desc …），读政策 treeInclude
  for (const row of rows) {
    if (row.file_type === "dir") continue;
    const policy = getPolicy(row.file_type as FileType);
    if (!policy?.treeInclude) continue;

    const leafName = row.relative_path.split("/").pop()!;

    if (
      row.file_type === "folder_desc" ||
      leafName.toLowerCase() === FOLDER_DESC_FILENAME.toLowerCase()
    ) {
      // 描述文档：挂载到父文件夹（不作为独立树节点）
      if (row.parent_id) {
        const parent = folderById.get(row.parent_id);
        if (parent) {
          parent.descDocumentId = row.document_id;
          const t = row.display_name.trim();
          if (t) parent.folderDisplayName = t;
        }
      }
    } else if (policy.treeVisible) {
      // 普通文档（md / html 等）
      const node: TreeNode = {
        type: "document",
        name: leafName,
        path: adjustPath(row.relative_path, row.owner_visitor_id),
        documentId: row.document_id,
        displayName: row.display_name,
        ownerVisitorId: row.owner_visitor_id,
        updatedAt: row.updated_at,
        fileType: row.file_type,
      };

      if (row.parent_id) {
        const parent = folderById.get(row.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }
  }
  // 递归排序
  for (const node of roots) {
    if (node.type === "folder") sortFolder(node);
  }

  return roots;
}

function deriveFolderName(row: DocumentRow): string {
  const t = row.display_name.trim();
  if (t) return t;
  return row.relative_path.split("/").pop() ?? row.relative_path;
}

function sortFolder(folder: TreeFolderNode): void {
  folder.children.sort(compareNode);
  for (const c of folder.children) {
    if (c.type === "folder") sortFolder(c);
  }
}

function compareNode(a: TreeNode, b: TreeNode): number {
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
  if (a.type === "folder" && b.type === "folder") {
    return folderSortKey(a).localeCompare(folderSortKey(b));
  }
  return a.name.localeCompare(b.name);
}

function folderSortKey(f: TreeFolderNode): string {
  return (f.folderDisplayName ?? f.name).toLowerCase();
}
