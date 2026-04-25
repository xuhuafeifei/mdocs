export type TreeNode = TreeFolderNode | TreeDocumentNode;

export interface TreeFolderNode {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
  /** When set, selecting this folder loads this document (path ends with desc.md). */
  descDocumentId?: string | null;
}

export interface TreeDocumentNode {
  type: "document";
  name: string;
  path: string;
  documentId: string;
  title: string;
  ownerVisitorId: string;
  updatedAt: string;
}
