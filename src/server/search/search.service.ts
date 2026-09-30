/**
 * 文档全文检索服务
 *
 * 职责：
 * - 解析用户搜索查询，在标题 / 正文两路 FTS5 索引中执行 BM25 关键词匹配
 * - 尽力补充本地 embedding 语义近邻（模型未就绪 / 失败则跳过）
 * - 按 document_id 合并打分（标题权重高于正文；语义低于标题）
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
import { querySemanticNeighbors } from "./embedding-store.js";

/** 与索引写入侧一致：查询也先 jieba，再交给 FTS5 */
const JIEBA = Jieba.withDict(dict);

/** 标题命中权重（相对正文） */
const W_TITLE = 3.0;
/** 正文命中权重 */
const W_BODY = 1.0;
/** 仅语义命中时的权重（低于标题） */
const W_SEMANTIC = 0.8;

/** 检索模式：auto = FTS+语义混合（默认）；keyword = 仅关键词；semantic = 仅语义 */
export type SearchMode = "auto" | "keyword" | "semantic";

export interface SearchResult {
  documentId: string;
  displayName: string;
  relativePath: string;
  domainId: string;
  snippet: string;
  /** 合并后的排序分（越大越相关） */
  bm25Score: number;
  /** 文档所有者展示名 */
  ownerVisitorName: string;
  /** 最后修改时间（ISO） */
  updatedAt: string;
  /** 创建时间（ISO） */
  createdAt?: string;
  /** 可选：命中来源 */
  matchSource?: "fts" | "semantic" | "both";
  /** 命中来源明细：标题 / 正文 / 语义（供前端标注"凭什么命中"） */
  titleHit?: boolean;
  bodyHit?: boolean;
  semanticHit?: boolean;
}

/**
 * 查询分词：与索引写入/FTS MATCH 同一套 jieba 切词。
 * 供前端在标题/摘要中做命中高亮。
 */
export function tokenizeQuery(query: string): string[] {
  const trimmed = query.trim().replace(/"/g, "");
  if (!trimmed) return [];
  const words = JIEBA.cutForSearch(trimmed, true)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  return Array.from(new Set(words));
}

function escapeFts5Query(query: string): string {
  return tokenizeQuery(query).map((w) => `"${w}"`).join(" ");
}

/**
 * 在全文索引中搜索文档（按 mode 选择检索路）。
 */
export async function searchDocuments(params: {
  query: string;
  visitorId: string | null;
  domainId?: string;
  topN?: number;
  mode?: SearchMode;
}): Promise<SearchResult[]> {
  const db = getDb();
  const topN = params.topN ?? 10;
  const mode: SearchMode =
    params.mode === "keyword" || params.mode === "semantic" ? params.mode : "auto";

  let merged: MergedHit[];
  if (mode === "semantic") {
    // 仅语义：不查 FTS；模型未就绪时 trySemanticHits 返回空
    const semanticHits = await trySemanticHits(params.query, params.domainId, topN * 3);
    merged = mergeFtsAndSemantic([], semanticHits);
  } else {
    const titleRows = queryTitleFts(db, params.query, topN * 2, params.domainId);
    const bodyRows = queryBodyFts(db, params.query, topN * 4, params.domainId);
    const ftsMerged = mergeFtsHits(titleRows, bodyRows);
    if (mode === "keyword") {
      merged = ftsMerged;
    } else {
      const semanticHits = await trySemanticHits(params.query, params.domainId, topN * 3);
      merged = mergeFtsAndSemantic(ftsMerged, semanticHits);
    }
  }
  if (merged.length === 0) return [];

  const metaById = loadDocumentSearchMeta(
    db,
    merged.map((r) => r.document_id),
  );

  // 语义-only 命中可能缺少 FTS 里的 display/path；从主表补
  fillMissingDocFields(db, merged);

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
        : row.semanticSnippet || row.display_name || "标题命中";

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
      createdAt: meta?.createdAt,
      matchSource: row.matchSource,
      titleHit: row.titleHit,
      bodyHit: row.bodyHit,
      semanticHit: row.semanticHit,
    });

    if (results.length >= topN) break;
  }

  return results;
}

async function trySemanticHits(
  query: string,
  domainId: string | undefined,
  topK: number,
): Promise<Array<{ document_id: string; domain_id: string; score: number; snippet: string }>> {
  try {
    const hits = await querySemanticNeighbors({ query, domainId, topK });
    return hits.map((h) => ({
      document_id: h.documentId,
      domain_id: h.domainId,
      score: h.score,
      snippet: h.snippet,
    }));
  } catch {
    return [];
  }
}

/** 从主表批量取作者名与更新/创建时间（不冗余进 FTS） */
function loadDocumentSearchMeta(
  db: Database.Database,
  documentIds: string[],
): Map<string, { ownerVisitorName: string; updatedAt: string; createdAt: string }> {
  const out = new Map<string, { ownerVisitorName: string; updatedAt: string; createdAt: string }>();
  const ids = Array.from(new Set(documentIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT d.document_id, d.updated_at, d.created_at,
              COALESCE(v.visitor_name, '') AS owner_visitor_name
       FROM documents d
       LEFT JOIN visitors v ON v.visitor_id = d.owner_visitor_id
       WHERE d.document_id IN (${placeholders})`,
    )
    .all(...ids) as Array<{
    document_id: string;
    updated_at: string;
    created_at: string;
    owner_visitor_name: string;
  }>;

  for (const row of rows) {
    out.set(row.document_id, {
      ownerVisitorName: row.owner_visitor_name,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    });
  }
  return out;
}

function fillMissingDocFields(db: Database.Database, merged: MergedHit[]): void {
  const need = merged.filter((r) => !r.display_name || !r.relative_path || !r.owner_visitor_id);
  if (need.length === 0) return;
  const ids = need.map((r) => r.document_id);
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT document_id, display_name, relative_path, domain_id, owner_visitor_id, permission
       FROM documents WHERE document_id IN (${placeholders})`,
    )
    .all(...ids) as Array<{
    document_id: string;
    display_name: string;
    relative_path: string;
    domain_id: string;
    owner_visitor_id: string;
    permission: number;
  }>;
  const byId = new Map(rows.map((r) => [r.document_id, r]));
  for (const hit of need) {
    const row = byId.get(hit.document_id);
    if (!row) continue;
    hit.display_name = hit.display_name || row.display_name;
    hit.relative_path = hit.relative_path || row.relative_path;
    hit.domain_id = hit.domain_id || row.domain_id;
    hit.owner_visitor_id = hit.owner_visitor_id || row.owner_visitor_id;
    hit.permission = hit.permission || row.permission;
  }
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
  semanticSnippet: string;
  finalScore: number;
  titleHit: boolean;
  bodyHit: boolean;
  semanticHit: boolean;
  matchSource: "fts" | "semantic" | "both";
}

/**
 * FTS5 bm25：越小（越负）越好。映射到 (0, 1]，越大越好。
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
      semanticSnippet: "",
      finalScore: W_TITLE * row.titleRank + W_BODY * row.bodyRank,
      titleHit: row.titleRank > 0,
      bodyHit: row.bodyRank > 0,
      semanticHit: false,
      matchSource: "fts" as const,
    }))
    .sort((a, b) => b.finalScore - a.finalScore);
}

function mergeFtsAndSemantic(
  fts: MergedHit[],
  semantic: Array<{ document_id: string; domain_id: string; score: number; snippet: string }>,
): MergedHit[] {
  const map = new Map<string, MergedHit>();
  for (const row of fts) {
    map.set(row.document_id, { ...row });
  }

  for (const hit of semantic) {
    const existing = map.get(hit.document_id);
    if (existing) {
      existing.matchSource = "both";
      existing.semanticHit = true;
      if (!existing.semanticSnippet) existing.semanticSnippet = hit.snippet;
      // FTS 分保留；不抬升语义以免压过标题命中
    } else {
      map.set(hit.document_id, {
        document_id: hit.document_id,
        display_name: "",
        relative_path: "",
        domain_id: hit.domain_id,
        owner_visitor_id: "",
        permission: 1,
        bodyContent: "",
        semanticSnippet: hit.snippet,
        finalScore: W_SEMANTIC * Math.max(0, hit.score),
        titleHit: false,
        bodyHit: false,
        semanticHit: true,
        matchSource: "semantic",
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.finalScore - a.finalScore);
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
    return [];
  }
}

function extractSnippet(text: string, query: string, maxLen = 200): string {
  if (text.length <= maxLen) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) {
    return text.slice(0, maxLen) + "…";
  }

  const start = Math.max(0, idx - Math.floor(maxLen / 4));
  const end = Math.min(text.length, start + maxLen);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}
