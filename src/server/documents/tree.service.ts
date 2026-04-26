import { getDb } from "../db/connection.js";
import { listDocumentsByDomain, findDocumentInvite, type DocumentRow } from "../db/repositories/document.repo.js";
import { findDomainById } from "../db/repositories/domain.repo.js";
import { getConfig } from "../config/index.js";
import { FOLDER_DESC_FILENAME } from "../../shared/folderDesc.js";
import { stripDomainPathPrefix } from "../../shared/personalDomain.js";
import type {
  TreeFolderNode,
  TreeNode,
} from "../../shared/types/tree.js";

export function buildDocumentTree(domainId?: string, visitorId?: string | null): TreeNode[] {
  const cfg = getConfig();
  const effective = domainId?.trim() || cfg.defaultDomainId;
  const db = getDb();
  const domain = findDomainById(db, effective);
  if (domain && domain.permission === "private" && domain.domain_id !== visitorId) {
    return [];
  }
  const rows = listDocumentsByDomain(db, effective);
  const root: TreeFolderNode = { type: "folder", name: "", path: "", children: [] };
  for (const row of rows) {
    if (!canReadInTree(row, visitorId)) continue;
    const forTree = stripDomainPathPrefix(effective, row.relative_path);
    attachRow(root, row, forTree);
  }
  sortFolder(root);
  return root.children;
}

function canReadInTree(row: DocumentRow, visitorId: string | null | undefined): boolean {
  if (row.owner_visitor_id === visitorId) return true;
  if (row.permission === 1 || row.permission === 2) return true; // PUBLIC_READ or PUBLIC_EDIT
  if (!visitorId) return false;
  if (row.permission === 3) {
    return !!findDocumentInvite(getDb(), row.document_id, visitorId);
  }
  return false;
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
