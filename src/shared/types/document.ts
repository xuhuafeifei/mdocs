export interface DocumentSummary {
  documentId: string;
  domainId: string;
  relativePath: string;
  displayName: string;
  ownerVisitorId: string;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
  permission: number;
  fileType: string;
  parentId: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
  contentHash: string;
  /** 当前请求的访客是否通过邀请获得了编辑权限 */
  invitedEdit?: boolean;
}

export interface CreateDocumentRequest {
  domainId?: string;
  relativePath: string;
  displayName?: string;
  content: string;
  permission?: number;
  /** 内容格式，默认 'lexical'。传 'markdown' 时后端自动转换为 Lexical JSON */
  contentFormat?: 'markdown' | 'lexical';
}

export interface UpdateDocumentRequest {
  content: string;
  displayName?: string;
  permission?: number;
  /** 内容格式，默认 'lexical'。传 'markdown' 时后端自动转换为 Lexical JSON */
  contentFormat?: 'markdown' | 'lexical';
}
