/**
 * 「我的文章」HTTP / Agent 出参（驼峰 Response）。
 */

export interface MyDocumentResponse {
  documentId: string;
  domainId: string;
  relativePath: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  permission: number;
  fileType: string;
  creatorVisitorId?: string;
  creatorName?: string;
}

export interface MyDocumentsPageResponse {
  items: MyDocumentResponse[];
  total: number;
  offset: number;
  limit: number;
}
