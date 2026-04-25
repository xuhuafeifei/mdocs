import { getDb } from "../db/connection.js";
import { listDocumentsByDomain, type DocumentRow } from "../db/repositories/document.repo.js";
import { getConfig } from "../config/index.js";
import { FOLDER_DESC_FILENAME } from "../../shared/folderDesc.js";
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
    attachRow(root, row);
  }
  sortFolder(root);
  return root.children;
}

function attachRow(root: TreeFolderNode, row: DocumentRow): void {
  const segments = row.relative_path.split("/").filter((s) => s.length > 0);
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
    }
    return;
  }
  current.children.push({
    type: "document",
    name: leafName,
    path: row.relative_path,
    documentId: row.document_id,
    title: row.title,
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

function compareNode(a: TreeNode, b: TreeNode): number {
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
  return a.name.localeCompare(b.name);
}
