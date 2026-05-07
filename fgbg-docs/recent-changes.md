# 最近改动

## 1. 文档创建接口改为后端计算路径（ADR-003）

### 涉及文件

| 文件 | 做什么 |
|------|--------|
| `src/server/documents/document.service.ts` | 新增 `normalizeFileName()` + 路径自动计算；`createDocument` 参数从 `relativePath` 改为 `fileName` |
| `src/server/routes/documents.routes.ts` | POST route 参数验证从 `relativePath` 改为 `fileName` |
| `src/web/services/endpoints.ts` | `createDocumentApi` 入参类型改为 `fileName` |
| `src/web/app/hooks/useCreateModal.ts` | 移除前端路径拼接逻辑 |
| 测试文件 | 同步更新调用方 |

### 逻辑

```
createDocument({ fileName, parentId, ... })
  → normalizeFileName(fileName)         // trim + pop + 去非法字符 + 补 .md
  → if parentId:
      parentDoc = findDocumentById(parentId)  // 必须是 dir 类型
      relativePath = parentDoc.relative_path + '/' + normalizedFileName
    else:
      relativePath = normalizedFileName  // 域顶层
  → insert into documents
```

## 2. 全文检索（FTS5 + jieba 中文分词）

### 涉及文件

| 文件 | 做什么 |
|------|--------|
| `src/server/search/document-index-manager.ts` | 索引管理器：Lexical 文本提取 + jieba 分词 + FTS5 增删改 + 脏文档定时重建 |
| `src/server/search/search.service.ts` | 搜索服务：FTS5 查询 + BM25 排序 + 权限过滤 + 片段高亮 |
| `src/server/routes/documents.routes.ts` | POST `/api/documents/search` 路由 |
| `src/web/services/endpoints.ts` | 前端 `searchDocumentsApi` |

### 索引流程

```
createDocument/updateDocument
  → markDirty(documentId)             // is_dirty = 1
  → process.nextTick(asyncRebuild)    // 异步尝试重建
  → 定时器每 60s 扫描 is_dirty = 1 的文档重建

rebuildDocument(documentId):
  1. 查出 doc metadata (relative_path, updated_at)
  2. readDocument() 读磁盘 .md 文件
  3. extractLexicalText() → 解析 Lexical JSON → 提取纯文本
  4. tokenizeForSearch() → JIEBA.cutForSearch(text, true).join(" ")
  5. FTS5: delete old entry → insert new entry
  6. UPDATE documents SET is_dirty = 0 WHERE document_id = ? AND updated_at = ?  (乐观锁)
```

### 搜索流程

```
POST /api/documents/search { query, domainId?, topN? }
  → searchDocuments({ query, visitorId, domainId, topN })
  → FTS5 查询 (BM25 排序)
  → 对每条结果调用 canReadDocument() 过滤权限
  → extractSnippet() 摘取匹配片段
  → 返回 SearchResult[]
```

### 权限过滤

搜索结果的权限判断复用 `canReadDocument()`（与文档读取同一逻辑）。见 `fgbg-docs/auth-and-access-control.md`。
