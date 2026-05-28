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
  /** 服务端维护的当前提交指针（用于 pull/merge 冲突检测）。 */
  headCommitId?: string;
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

/** 409 VERSION_CONFLICT 时 error.details 的结构 */
export interface VersionConflictDetails {
  headCommitId: string;
  content: string;
  contentHash: string;
}

/** merge 发布：冲突解决后再次 PUT 时携带 */
export interface PublishMergeContext {
  /** 409 发生时的服务端 head，必须仍等于当前 head */
  expectedHeadCommitId: string;
  /** r_local 快照正文；格式与顶层 content 相同，由 contentFormat 统一转换 */
  localSnapshotContent?: string;
}

/** 发布时的版本语义（乐观锁 / 合并） */
export interface PublishVersionContext {
  /** 客户端开编或上次同步时的 head */
  baseCommitId?: string;
  /** 存在时表示合并发布；此时 baseCommitId 必填 */
  merge?: PublishMergeContext;
}

export interface UpdateDocumentRequest {
  content: string;
  displayName?: string;
  permission?: number;
  /** 内容格式，默认 'lexical'。传 'markdown' 时后端自动转换为 Lexical JSON */
  contentFormat?: 'markdown' | 'lexical';
  /** 发布版本信息；未传则跳过冲突检测（兼容旧客户端） */
  version?: PublishVersionContext;
}

/** GET /documents/:id/sync-status 响应 */
export type DocumentSyncStatusKind = 'up_to_date' | 'behind' | 'ahead';

export interface DocumentSyncStatus {
  status: DocumentSyncStatusKind;
  headCommitId: string | null;
}

export interface ConvertContentRequest {
  content: string;
  from: 'lexical' | 'markdown';
  to: 'lexical' | 'markdown';
}
