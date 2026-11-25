/**
 * 搜索索引相关表实体（蛇形，与 SQL 列对齐）。
 * FTS5 虚表无自增业务 PK；rowid 映射表与 embedding 块为普通表。
 */

/** 虚表 documents_fts（INSERT 列；SELECT 可含 rowid）。 */
export interface DocumentsFts {
  content: string;
  document_id: string;
  display_name: string;
  relative_path: string;
  domain_id: string;
  owner_visitor_id: string;
  permission: number;
}

/** 虚表 documents_fts_title。 */
export interface DocumentsFtsTitle {
  title: string;
  document_id: string;
  display_name: string;
  relative_path: string;
  domain_id: string;
  owner_visitor_id: string;
  permission: number;
}

/** 表 documents_fts_rowid */
export interface DocumentsFtsRowid {
  document_id: string;
  fts_rowid: number;
}

/** 表 documents_fts_title_rowid */
export interface DocumentsFtsTitleRowid {
  document_id: string;
  fts_rowid: number;
}

/** 表 document_embedding_chunks（复合主键 document_id + chunk_index）。 */
export interface DocumentEmbeddingChunks {
  document_id: string;
  domain_id: string;
  chunk_index: number;
  text: string;
  embedding: Buffer;
  updated_at: string;
}

/** FTS MATCH 投影（含 bm25）；非表 1:1，用 *Row。 */
export interface DocumentsFtsHitRow {
  document_id: string;
  display_name: string;
  relative_path: string;
  domain_id: string;
  owner_visitor_id: string;
  permission: number;
  content?: string;
  bm25_score: number;
}
