/**
 * document_comments 表实体（蛇形，与 SQL 列对齐）。
 * HTTP 出参见 response/。
 */

/** 表 document_comments */
export interface DocumentComments {
  comment_id: string;
  document_id: string;
  visitor_id: string;
  visitor_name: string;
  parent_id: string | null;
  reply_to_visitor_id: string | null;
  reply_to_visitor_name: string | null;
  content: string;
  /** 0 未删，1 软删。 */
  is_deleted: number;
  created_at: string;
  updated_at: string;
}
