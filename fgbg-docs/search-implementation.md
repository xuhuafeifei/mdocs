# 全文检索功能

## 涉及文件

| 文件 | 职责 |
|------|------|
| `src/server/search/document-index-manager.ts` | 索引管理器：Lexical JSON 解析、jieba 分词、FTS5 索引增删改、脏文档定时重建 |
| `src/server/search/search.service.ts` | 搜索服务：FTS5 查询、BM25 排序、权限过滤、片段截取 |
| `src/server/routes/documents.routes.ts` | POST `/api/documents/search` 路由入口 |
| `src/web/services/endpoints.ts` | 前端 `searchDocumentsApi()` |
| `src/server/search/document-index-manager.test.ts` | 单元测试 |

## 数据结构

### `documents_fts` (FTS5 虚拟表)

| 字段 | 说明 |
|------|------|
| `content` | 分词后的文档正文（jieba 预处理为空格分隔） |
| `document_id`, `display_name`, `relative_path`, `domain_id`, `owner_visitor_id`, `permission` | 用于权限过滤和结果展示（UNINDEXED） |

分词器：`unicode61`（英文/数字默认），中文由 `@node-rs/jieba` 调用 `cutForSearch` 预处理。

### `documents_fts_rowid` (映射表)

| 字段 | 说明 |
|------|------|
| `document_id` | TEXT PK |
| `fts_rowid` | FTS5 虚拟表中的 rowid，用于定位删除/更新条目 |

### `documents.is_dirty` (脏标记)

`1` = 待重建索引，`0` = 已同步。定时器每 60s 扫描 `is_dirty = 1 AND file_type = 'md'` 的文档重建。

## 关键逻辑

### extractLexicalText(rawContent)

```
1. JSON.parse(rawContent)
2. 递归遍历 root.children，收集 type="text" 节点的 text 值
3. 最大递归深度 40，非 text 节点跳过
4. 若 JSON 解析失败，视为纯文本直接返回
```

### tokenizeForSearch(text)

```
JIEBA.cutForSearch(text, true).join(" ")
```

使用搜索引擎模式（`cutForSearch`），会产出过分词结果（如"数据库"→"数据 据库 数据库"），提高召回率。

### 权限过滤

搜索结果的权限判断复用 `canReadDocument()`（`src/server/access/access-control.ts`），与文档读取逻辑一致：

- `public` 域：仅档位 3/4 可读，任何人可见
- `restricted` 域：仅档位 1/2 可读，域成员可见
- `private` 域：按档位实际语义，owner 始终可见

批量查询域信息缓存到 Map，避免循环内重复查库。
