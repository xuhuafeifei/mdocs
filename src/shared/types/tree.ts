export type TreeNode = TreeFolderNode | TreeDocumentNode;

export interface TreeFolderNode {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
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
