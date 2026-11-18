/**
 * document_commits / commit_parents 表实体（与列一一对应）。
 */
import type { PublishSource } from "../../../../shared/publish-meta.js";

/** 表 document_commits */
export interface DocumentCommits {
  commit_id: string;
  document_id: string;
  content_hash: string;
  blob_ref: string;
  author_visitor_id: string;
  created_at: string;
  message: string;
  source: PublishSource;
}

/** 表 commit_parents */
export interface CommitParents {
  child_commit_id: string;
  parent_commit_id: string;
}
