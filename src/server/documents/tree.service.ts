import { getDb } from "../db/connection.js";
import { listDocumentsByDomain, type DocumentRow } from "../db/repositories/document.repo.js";
import { findDomainById, isDomainMember } from "../db/repositories/domain.repo.js";
import { resolveDomainAccess, canEnterDomainTree } from "../access/domain-access.js";
import { canReadDocument, type DomainAccessInfo } from "../access/access-control.js";
import { getConfig } from "../config/index.js";
import { FOLDER_DESC_FILENAME } from "../../shared/folderDesc.js";
import type {
  TreeFolderNode,
  TreeNode,
} from "../../shared/types/tree.js";

/**
 * 构建指定域的文档目录树。
 */
export function buildDocumentTree(domainId?: string, visitorId?: string | null): TreeNode[] {
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
  return buildTreeFromRows(filtered);
}

/**
 * 根据过滤后的文档行数组，按 parent_id 构建文档树。
 *
 * 步骤：
 * 1. 为所有 dir 创建文件夹节点，document_id → TreeFolderNode 映射
 * 2. 处理 md：___desc___.md 挂载到父文件夹，普通文档挂在父文件夹下
 * 3. 将文件夹挂在各自的父文件夹下
 * 4. 对根节点和子节点递归排序
 */
function buildTreeFromRows(rows: DocumentRow[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const folderById = new Map<string, TreeFolderNode>();
  // 记录已添加到 roots 的文件夹 ID，避免重复
  const addedToRoots = new Set<string>();

  // 第一步：创建所有文件夹节点
  for (const row of rows) {
    if (row.file_type === 'dir') {
      const node: TreeFolderNode = {
        type: "folder",
        name: deriveFolderName(row),
        path: row.relative_path,
        documentId: row.document_id,
        children: [],
      };
      folderById.set(row.document_id, node);
    }
  }

  // 第二步：将文件夹挂在父节点或根级
  for (const row of rows) {
    if (row.file_type !== 'dir') continue;
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

  // 第三步：处理 md 类型
  for (const row of rows) {
    if (row.file_type !== 'md') continue;
    const leafName = row.relative_path.split("/").pop()!;

    if (leafName.toLowerCase() === FOLDER_DESC_FILENAME.toLowerCase()) {
      // 描述文档：挂载到父文件夹
      if (row.parent_id) {
        const parent = folderById.get(row.parent_id);
        if (parent) {
          parent.descDocumentId = row.document_id;
          const t = row.display_name.trim();
          if (t) parent.folderDisplayName = t;
        }
      }
    } else {
      // 普通文档
      const node: TreeNode = {
        type: "document",
        name: leafName,
        path: row.relative_path,
        documentId: row.document_id,
        displayName: row.display_name,
        ownerVisitorId: row.owner_visitor_id,
        updatedAt: row.updated_at,
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
