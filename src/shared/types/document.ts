export interface DocumentSummary {
  documentId: string;
  domainId: string;
  relativePath: string;
  title: string;
  ownerVisitorId: string;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
  contentHash: string;
}

export interface CreateDocumentRequest {
  domainId?: string;
  relativePath: string;
  title?: string;
  content: string;
}

export interface UpdateDocumentRequest {
  content: string;
  title?: string;
}
