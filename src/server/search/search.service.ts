/**
 * 文档全文检索服务
 *
 * 职责：
 * - 解析用户搜索查询，在标题 / 正文两路 FTS5 索引中执行 BM25 关键词匹配
 * - 按 document_id 合并打分（标题权重高于正文）
 * - 按 domain 过滤并应用权限模型过滤可见文档
 * - 返回排序后的匹配结果
 */
import type Database from "better-sqlite3";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";
import { getDb } from "../db/connection.js";
import { findDomainById, isDomainMember } from "../db/repositories/domain.repo.js";
import { canReadDocument } from "../access/access-control.js";
import type { DocumentRow } from "../db/repositories/document.repo.js";
import type { DomainAccessInfo } from "../access/access-control.js";

/** 与索引写入侧一致：查询也先 jieba，再交给 FTS5 */
const JIEBA = Jieba.withDict(dict);

/** 标题命中权重（相对正文） */
const W_TITLE = 3.0;
/** 正文命中权重 */
const W_BODY = 1.0;

export interface SearchResult {
  documentId: string;
  displayName: string;
  relativePath: string;
  domainId: string;
  snippet: string;
  /** 合并后的排序分（越大越相关；语义已从「正文 bm25」改为两路加权分） */
  bm25Score: number;
  /** 文档所有者展示名 */
  ownerVisitorName: string;
  /** 最后修改时间（ISO） */
  updatedAt: string;
}

/**
 * 在全文索引中搜索文档。
 *
 * 流程：
 * 1. 标题索引 MATCH → 正文索引 MATCH
 * 2. 按 document_id 合并，final = W_TITLE * title_rank + W_BODY * body_rank
 * 3. 按 domainId 过滤（若传入，已在 SQL 下推）
 * 4. 对每个匹配文档执行 canReadDocument 权限检查
 * 5. 截取 topN 条结果
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

  // 标题路少取一些即可；正文路多取供权限过滤后仍够
  const titleRows = queryTitleFts(db, params.query, topN * 2, params.domainId);
  const bodyRows = queryBodyFts(db, params.query, topN * 4, params.domainId);

  const merged = mergeFtsHits(titleRows, bodyRows);
  if (merged.length === 0) return [];

  const metaById = loadDocumentSearchMeta(
    db,
    merged.map((r) => r.document_id),
  );

  // ---- 权限过滤 ----
  const domainIds = Array.from(new Set(merged.map((r) => r.domain_id)));
  const domainCache = new Map<string, { permission: string } | null>();
  for (const did of domainIds) {
    domainCache.set(did, findDomainById(db, did) ?? null);
  }

  const results: SearchResult[] = [];
  for (const row of merged) {
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

    const snippet =
      row.bodyContent.length > 0
        ? extractSnippet(row.bodyContent, params.query, 200)
        : row.display_name || "标题命中";

    const meta = metaById.get(row.document_id);

    results.push({
      documentId: row.document_id,
      displayName: row.display_name,
      relativePath: row.relative_path,
      domainId: row.domain_id,
      snippet,
      bm25Score: row.finalScore,
      ownerVisitorName: meta?.ownerVisitorName ?? "",
      updatedAt: meta?.updatedAt ?? "",
    });

    if (results.length >= topN) break;
  }

  return results;
}

/** 从主表批量取作者名与更新时间（不冗余进 FTS） */
function loadDocumentSearchMeta(
  db: Database.Database,
  documentIds: string[],
): Map<string, { ownerVisitorName: string; updatedAt: string }> {
  const out = new Map<string, { ownerVisitorName: string; updatedAt: string }>();
  const ids = Array.from(new Set(documentIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT d.document_id, d.updated_at,
              COALESCE(v.visitor_name, '') AS owner_visitor_name
       FROM documents d
       LEFT JOIN visitors v ON v.visitor_id = d.owner_visitor_id
       WHERE d.document_id IN (${placeholders})`,
    )
    .all(...ids) as Array<{
    document_id: string;
    updated_at: string;
    owner_visitor_name: string;
  }>;

  for (const row of rows) {
    out.set(row.document_id, {
      ownerVisitorName: row.owner_visitor_name,
      updatedAt: row.updated_at,
    });
  }
  return out;
}

interface FtsHitPayload {
  document_id: string;
  display_name: string;
  relative_path: string;
  domain_id: string;
  owner_visitor_id: string;
  permission: number;
  bm25_score: number;
}

interface BodyFtsHit extends FtsHitPayload {
  content: string;
}

interface MergedHit {
  document_id: string;
  display_name: string;
  relative_path: string;
  domain_id: string;
  owner_visitor_id: string;
  permission: number;
  bodyContent: string;
  finalScore: number;
}

/**
 * FTS5 bm25：越小（越负）越好。映射到 (0, 1]，越大越好。
 * 使用 sigmoid，避免负分被 max(0,·) 压扁成同一档。
 */
function rankFromBm25(bm25: number): number {
  return 1 / (1 + Math.exp(bm25));
}

function mergeFtsHits(titleRows: FtsHitPayload[], bodyRows: BodyFtsHit[]): MergedHit[] {
  const map = new Map<
    string,
    {
      document_id: string;
      display_name: string;
      relative_path: string;
      domain_id: string;
      owner_visitor_id: string;
      permission: number;
      bodyContent: string;
      titleRank: number;
      bodyRank: number;
    }
  >();

  for (const row of titleRows) {
    map.set(row.document_id, {
      document_id: row.document_id,
      display_name: row.display_name,
      relative_path: row.relative_path,
      domain_id: row.domain_id,
      owner_visitor_id: row.owner_visitor_id,
      permission: row.permission,
      bodyContent: "",
      titleRank: rankFromBm25(row.bm25_score),
      bodyRank: 0,
    });
  }

  for (const row of bodyRows) {
    const existing = map.get(row.document_id);
    if (existing) {
      existing.bodyRank = rankFromBm25(row.bm25_score);
      existing.bodyContent = row.content;
      if (!existing.display_name) existing.display_name = row.display_name;
      if (!existing.relative_path) existing.relative_path = row.relative_path;
    } else {
      map.set(row.document_id, {
        document_id: row.document_id,
        display_name: row.display_name,
        relative_path: row.relative_path,
        domain_id: row.domain_id,
        owner_visitor_id: row.owner_visitor_id,
        permission: row.permission,
        bodyContent: row.content,
        titleRank: 0,
        bodyRank: rankFromBm25(row.bm25_score),
      });
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      document_id: row.document_id,
      display_name: row.display_name,
      relative_path: row.relative_path,
      domain_id: row.domain_id,
      owner_visitor_id: row.owner_visitor_id,
      permission: row.permission,
      bodyContent: row.bodyContent,
      finalScore: W_TITLE * row.titleRank + W_BODY * row.bodyRank,
    }))
    .sort((a, b) => b.finalScore - a.finalScore);
}

function queryTitleFts(
  db: Database.Database,
  query: string,
  limit: number,
  domainIdPattern?: string,
): FtsHitPayload[] {
  const safeQuery = escapeFts5Query(query);
  if (!safeQuery) return [];

  const domainClause = domainIdPattern ? "AND domain_id = ?" : "";
  const params: unknown[] = domainIdPattern ? [safeQuery, domainIdPattern, limit] : [safeQuery, limit];

  try {
    return db
      .prepare(
        `SELECT document_id, display_name, relative_path, domain_id, owner_visitor_id, permission,
                bm25(documents_fts_title) AS bm25_score
         FROM documents_fts_title
         WHERE documents_fts_title MATCH ? ${domainClause}
         ORDER BY bm25_score ASC
         LIMIT ?`,
      )
      .all(...params) as FtsHitPayload[];
  } catch {
    return [];
  }
}

function queryBodyFts(
  db: Database.Database,
  query: string,
  limit: number,
  domainIdPattern?: string,
): BodyFtsHit[] {
  const safeQuery = escapeFts5Query(query);
  if (!safeQuery) return [];

  const domainClause = domainIdPattern ? "AND domain_id = ?" : "";
  const params: unknown[] = domainIdPattern ? [safeQuery, domainIdPattern, limit] : [safeQuery, limit];

  try {
    return db
      .prepare(
        `SELECT document_id, display_name, relative_path, domain_id, owner_visitor_id, permission, content,
                bm25(documents_fts) AS bm25_score
         FROM documents_fts
         WHERE documents_fts MATCH ? ${domainClause}
         ORDER BY bm25_score ASC
         LIMIT ?`,
      )
      .all(...params) as BodyFtsHit[];
  } catch {
    // FTS5 语法异常或表尚未就绪时返回空（降级：标题路仍可能有结果）
    return [];
  }
}

/**
 * 将用户查询分词并转义为 FTS5 MATCH 表达式。
 *
 * 索引写入侧对中文做了 jieba cutForSearch；查询必须同样分词，否则整句
 * `"恢复码"` 无法命中已拆成 `恢复` / `码` 的索引。
 * 每个 token 用双引号包裹，避免 FTS5 特殊字符被解释为操作符。
 */
function escapeFts5Query(query: string): string {
  const trimmed = query.trim().replace(/"/g, "");
  if (!trimmed) return "";
  const words = JIEBA.cutForSearch(trimmed, true)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  if (words.length === 0) return "";
  // 去重：cutForSearch 会产出重叠 token
  return Array.from(new Set(words)).map((w) => `"${w}"`).join(" ");
}

/**
 * 从文档内容中提取包含查询词的片段。
 *
 * @param text 文档全文（索引侧可能是分词后文本）
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

  const start = Math.max(0, idx - Math.floor(maxLen / 4));
  const end = Math.min(text.length, start + maxLen);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}
