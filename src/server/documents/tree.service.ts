import { getDb } from "../db/connection.js";
import { listDocumentsByDomain, type DocumentRow } from "../db/repositories/document.repo.js";
import { getConfig } from "../config/index.js";
import { FOLDER_DESC_FILENAME } from "../../shared/folderDesc.js";
import { stripDomainPathPrefix } from "../../shared/personalDomain.js";
import type {
  TreeFolderNode,
  TreeNode,
} from "../../shared/types/tree.js";

export function buildDocumentTree(domainId?: string): TreeNode[] {
  const cfg = getConfig();
  const effective = domainId?.trim() || cfg.defaultDomainId;
  const rows = listDocumentsByDomain(getDb(), effective);
  const root: TreeFolderNode = { type: "folder", name: "", path: "", children: [] };
  for (const row of rows) {
    const forTree = stripDomainPathPrefix(effective, row.relative_path);
    attachRow(root, row, forTree);
  }
  sortFolder(root);
  return root.children;
}

function attachRow(root: TreeFolderNode, row: DocumentRow, forTree: string): void {
  const segments = forTree.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return;
  let current: TreeFolderNode = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const name = segments[i]!;
    const childPath = current.path ? `${current.path}/${name}` : name;
    let next = current.children.find(
      (c): c is TreeFolderNode => c.type === "folder" && c.name === name,
    );
    if (!next) {
      next = { type: "folder", name, path: childPath, children: [] };
      current.children.push(next);
    }
    current = next;
  }
  const leafName = segments[segments.length - 1]!;
  if (leafName.toLowerCase() === FOLDER_DESC_FILENAME.toLowerCase()) {
    if (segments.length >= 2) {
      current.descDocumentId = row.document_id;
      const t = row.display_name.trim();
      if (t) current.folderDisplayName = t;
    }
    return;
  }
  current.children.push({
    type: "document",
    name: leafName,
    path: forTree,
    documentId: row.document_id,
    displayName: row.display_name,
    ownerVisitorId: row.owner_visitor_id,
    updatedAt: row.updated_at,
  });
}

function sortFolder(folder: TreeFolderNode): void {
  folder.children.sort(compareNode);
  for (const c of folder.children) {
    if (c.type === "folder") sortFolder(c);
  }
}

function folderSortKey(f: TreeFolderNode): string {
  return (f.folderDisplayName ?? f.name).toLowerCase();
}

function compareNode(a: TreeNode, b: TreeNode): number {
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
  if (a.type === "folder" && b.type === "folder") {
    return folderSortKey(a).localeCompare(folderSortKey(b));
  }
  return a.name.localeCompare(b.name);
}
