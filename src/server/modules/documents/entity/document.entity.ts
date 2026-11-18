/**
 * documents / document_invites 表实体与查询 Row（蛇形，与 SQL 列对齐）。
 * HTTP 出参见 response/；进参见 request/。
 */

/** 表 documents */
export interface Documents {
  document_id: string;
  domain_id: string;
  relative_path: string;
  display_name: string;
  owner_visitor_id: string;
  created_by: string;
  updated_by: string;
  content_hash: string;
  head_commit_id: string | null;
  created_at: string;
  updated_at: string;
  permission: number;
  file_type: string;
  parent_id: string | null;
}

/** 表 document_invites */
export interface DocumentInvites {
  document_id: string;
  visitor_id: string;
  permission: string;
}

/**
 * 查询投影：按 owner 列「我的文章」列表（documents 子集 + visitors.visitor_name）。
 * 不是表实体，也不是 HTTP Response。
 */
export interface DocumentsOwnerRow {
  document_id: string;
  domain_id: string;
  relative_path: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  permission: number;
  file_type: string;
  owner_visitor_id: string;
  creator_name: string | null;
}
