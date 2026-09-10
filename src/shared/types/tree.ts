export type TreeNode = TreeFolderNode | TreeDocumentNode;

export interface TreeFolderNode {
  type: "folder";
  name: string;
  path: string;
  documentId: string;
  children: TreeNode[];
  /** When set, selecting this folder loads this document (path ends with desc.md). */
  descDocumentId?: string | null;
  /** From folder `desc.md` row `display_name` when present; UI label, while `name`/`path` stay storage-relative. */
  folderDisplayName?: string | null;
}

export interface TreeDocumentNode {
  type: "document";
  name: string;
  path: string;
  documentId: string;
  displayName: string;
  ownerVisitorId: string;
  updatedAt: string;
  fileType: string;
}

/** 按目录取子树的精简节点（GET /folder/:folderId/tree） */
export type FolderSubtreeNode =
  | {
      type: "folder";
      id: string;
      title: string;
      children: FolderSubtreeNode[];
    }
  | {
      type: "document";
      id: string;
      title: string;
    };
