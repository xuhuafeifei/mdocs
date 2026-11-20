/**
 * attachments 表实体（蛇形，与 SQL 列对齐）。
 * 文档侧附件元数据；字节在 files/assets/。
 */

/** 表 attachments */
export interface Attachments {
  attachment_id: string;
  document_id: string | null;
  relative_path: string;
  mime_type: string | null;
  byte_size: number;
  owner_visitor_id: string;
  created_at: string;
}
