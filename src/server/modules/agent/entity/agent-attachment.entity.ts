/**
 * agent_attachments 表实体（蛇形，与 SQL 列对齐）。
 */

export type AgentAttachmentStatus = "staging" | "persisted";

/** 表 agent_attachments */
export interface AgentAttachments {
  attachment_id: string;
  owner_visitor_id: string;
  session_id: string;
  sha256: string;
  name: string;
  mime: string;
  byte_size: number;
  status: AgentAttachmentStatus;
  created_at: string;
  persisted_at: string | null;
}
