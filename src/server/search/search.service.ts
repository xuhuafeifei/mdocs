/**
 * 文档全文检索服务
 *
 * 职责：
 * - 解析用户搜索查询，在 FTS5 索引中执行 BM25 关键词匹配
 * - 按 domain 过滤并应用五级权限模型过滤可见文档
 * - 返回排序后的匹配结果
 */
import type Database from "better-sqlite3";
import { getDb } from "../db/connection.js";
import { findDomainById, isDomainMember } from "../db/repositories/domain.repo.js";
import { canReadDocument } from "../access/access-control.js";
import type { DocumentRow } from "../db/repositories/document.repo.js";
import type { DomainAccessInfo } from "../access/access-control.js";

export interface SearchResult {
  documentId: string;
  displayName: string;
  relativePath: string;
  domainId: string;
  snippet: string;
  bm25Score: number;
}

/**
 * 在全文索引中搜索文档。
 *
 * 流程：
 * 1. 在 documents_fts 中执行 MATCH 查询，按 BM25 排名
 * 2. 按 domainId 过滤（若传入）
 * 3. 对每个匹配文档执行 canReadDocument 权限检查
 * 4. 截取 topN 条结果
 *
 * @param visitorId 当前访客 ID（未登录为 null）
 */
export function searchDocuments(params: {
  query: string;
  visitorId: string | null;
  domainId?: string;
  topN?: number;
}): SearchResult[] {
  const db = getDb();
  const topN = params.topN ?? 10;

  // ---- 查询 FTS5 ----
  // 取足够多的候选结果（topN * 4），供权限过滤后仍有足够条目
  const ftsRows = queryFts(db, params.query, topN * 4, params.domainId);

  if (ftsRows.length === 0) return [];

  // ---- 权限过滤 ----
  // 收集涉及的各域信息，批量查询以复用
  const domainIds = Array.from(new Set(ftsRows.map((r) => r.domain_id)));
  const domainCache = new Map<string, { permission: string } | null>();
  for (const did of domainIds) {
    domainCache.set(did, findDomainById(db, did) ?? null);
  }

  const results: SearchResult[] = [];
  for (const row of ftsRows) {
    // 构造 DocumentRow 用于权限判定
    const docRow: DocumentRow = {
      document_id: row.document_id,
      domain_id: row.domain_id,
      relative_path: row.relative_path,
      display_name: row.display_name,
      owner_visitor_id: row.owner_visitor_id,
      created_by: row.owner_visitor_id,
      updated_by: row.owner_visitor_id,
      content_hash: "",
      head_commit_id: null,
      created_at: "",
      updated_at: "",
      permission: row.permission,
      file_type: "md",
      parent_id: null,
    };

    const domain = domainCache.get(row.domain_id);
    const domainPermission = domain?.permission ?? "public";
    const isMember = !!(params.visitorId && domain && isDomainMember(db, row.domain_id, params.visitorId));
    const domainInfo: DomainAccessInfo = { domainPermission, isDomainMember: isMember };

    if (!canReadDocument(docRow, params.visitorId ?? null, domainInfo)) continue;

    // 截取内容片段（最多 200 字符，从第一个匹配词附近开始）
    const snippet = extractSnippet(row.content, params.query, 200);

    results.push({
      documentId: row.document_id,
      displayName: row.display_name,
      relativePath: row.relative_path,
      domainId: row.domain_id,
      snippet,
      bm25Score: row.bm25_score != null ? row.bm25_score : 0,
    });

    if (results.length >= topN) break;
  }

  return results;
}

interface FtsRow {
  document_id: string;
  display_name: string;
  relative_path: string;
  domain_id: string;
  owner_visitor_id: string;
  permission: number;
  content: string;
  bm25_score: number;
}

/**
 * 执行 FTS5 查询，返回按 BM25 排名升序排列的结果。
 *
 * @param db 数据库实例
 * @param query 用户输入的查询字符串
 * @param limit 返回数量上限
 * @param domainIdPattern 可选域过滤（通过 FTS5 UNINDEXED 列）
 */
function queryFts(db: Database.Database, query: string, limit: number, domainIdPattern?: string): FtsRow[] {
  // 转义 FTS5 特殊字符，防止用户输入破坏查询语法
  const safeQuery = escapeFts5Query(query);
  if (!safeQuery) return [];

  // 构造 SQL：MATCH 必须用字符串字面量，domain_id 用参数绑定防止注入
  const domainClause = domainIdPattern ? "AND domain_id = ?" : "";
  const params: unknown[] = domainIdPattern ? [safeQuery, domainIdPattern, limit] : [safeQuery, limit];

  try {
    return db.prepare(
      `SELECT document_id, display_name, relative_path, domain_id, owner_visitor_id, permission, content, bm25(documents_fts) AS bm25_score
       FROM documents_fts
       WHERE documents_fts MATCH ? ${domainClause}
       ORDER BY bm25_score ASC
       LIMIT ?`,
    ).all(...params) as FtsRow[];
  } catch {
    // FTS5 语法异常时返回空（如用户输入了无法解析的字符序列）
    return [];
  }
}

/**
 * 转义用户输入中可能破坏 FTS5 语法的特殊字符。
 *
 * FTS5 特殊字符：* " + - ^ ( ) { } [ ] ~ . : 、空格
 * 将每个词用双引号包裹以避免特殊字符被解释为操作符。
 */
function escapeFts5Query(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";
  // 移除引号避免破坏 FTS5 语法，按空白分词后每词用双引号包裹，词间 AND
  const sanitized = trimmed.replace(/"/g, "");
  const words = sanitized.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "";
  return words.map((w) => `"${w}"`).join(" ");
}

/**
 * 从文档内容中提取包含查询词的片段。
 *
 * @param text 文档全文
 * @param query 用户查询
 * @param maxLen 片段最大长度，默认 200 字符
 */
function extractSnippet(text: string, query: string, maxLen = 200): string {
  if (text.length <= maxLen) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) {
    // 未找到精确匹配（FTS 可能匹配了词干变体），返回开头
    return text.slice(0, maxLen) + "…";
  }

  // 从匹配位置开始前移一些字符，保证片段完整
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, start + maxLen);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end).replace(/\n/g, " ") + suffix;
}
