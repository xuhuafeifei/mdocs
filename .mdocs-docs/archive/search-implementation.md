# 全文检索功能

## 涉及文件

| 文件 | 职责 |
|------|------|
| `src/server/search/document-index-manager.ts` | 索引管理器：Lexical JSON 解析、jieba 分词、正文+标题 FTS5 增删改、脏文档定时重建 |
| `src/server/search/search.service.ts` | 搜索服务：标题/正文两路 MATCH、合并打分、权限过滤、片段截取 |
| `src/server/db/schema.ts` | `documents_fts` / `documents_fts_title` + rowid；升级库标 dirty 补标题索引 |
| `src/server/routes/documents.routes.ts` | POST `/api/documents/search` 路由入口 |
| `src/web/services/endpoints.ts` | 前端 `searchDocumentsApi()` |
| `src/web/app/DocSearchOverlay.tsx` | 当前工作空间搜索浮层（侧栏 / ⌘K） |
| `src/server/search/document-index-manager.test.ts` | 单元测试 |

## 数据结构

### `documents_fts` (FTS5，正文)

| 字段 | 说明 |
|------|------|
| `content` | 分词后的文档正文（jieba 预处理为空格分隔） |
| `document_id`, `display_name`, `relative_path`, `domain_id`, `owner_visitor_id`, `permission` | UNINDEXED 载荷（权限过滤与展示） |

### `documents_fts_title` (FTS5，标题)

| 字段 | 说明 |
|------|------|
| `title` | jieba 分词后的 `display_name` |
| 其余列 | 与正文表同构的 UNINDEXED 载荷 |

分词器：`unicode61`（英文/数字默认），中文由 `@node-rs/jieba` 调用 `cutForSearch` 预处理。**查询侧同样 jieba**，否则整句无法命中已拆分的索引。

### rowid 映射

- `documents_fts_rowid` / `documents_fts_title_rowid`：`document_id` → `fts_rowid`，删除用 `DELETE FROM fts WHERE rowid = ?`。

### `documents.is_dirty`

`1` = 待重建，`0` = 已同步。定时器扫 `is_dirty = 1 AND file_type = 'md'`；一次重建同时写两路索引。

## 召回

```
title MATCH (topN*2) + body MATCH (topN*4)
  → merge by document_id
  → final = 3 * rank(title_bm25) + 1 * rank(body_bm25)
  → canReadDocument 过滤 → topN
```

`rank(bm25) = 1 / (1 + exp(bm25))`（FTS5 越小越好，映射为越大越好）。  
对外 `bm25Score` 字段语义为**合并分**（非原始正文 bm25）。

仅标题命中时 `snippet` 用 `display_name`；否则从正文抽片段。

## 权限过滤

仍在业务层 `canReadDocument()`，FTS 不做 ACL。`owner_visitor_id` / `permission` 冗余在 FTS 载荷里，避免回表。
