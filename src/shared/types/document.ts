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
  /** 服务端当前 head（同 remoteCommitId，资源字段保留 head 说法）。 */
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
  /** 409 / 打开 merge 时的远端 tip，必须仍等于当前 head */
  remoteCommitId: string;
  /** r_local 快照正文；格式与顶层 content 相同，由 contentFormat 统一转换 */
  localSnapshotContent?: string;
}

/** 发布时的版本语义（乐观锁 / 合并） */
export interface PublishVersionContext {
  /** 开编分叉点（首次未发布编辑时服务端 head） */
  localBaseCommitId?: string;
  /** 存在时表示合并发布；此时 localBaseCommitId 必填 */
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
