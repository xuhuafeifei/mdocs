# ADR-003: 文档创建接口改为后端自动计算路径

> 状态：accepted
> 日期：2026-05-07

## 上下文

文档创建接口原本要求前端传入完整的 `relativePath`（如 `"folder/sub/doc.md"`），前端需要自己拼接路径字符串。这导致以下问题：

1. **路径构造逻辑分散**：前端 `useCreateModal.ts` 拼接路径，后端 `document.service.ts` 又做一次路径验证，两份逻辑可能不一致。
2. **前端负担不合理**：前端不应该关心文件存储路径的格式（扩展名、非法字符、路径分隔符等）。
3. **易出错**：前端传的路径可能不含 `.md` 后缀、含非法字符、或路径分隔符不规范。
4. **用户体验差**：创建文档时需要前端计算出 `parentPath` 再拼接，逻辑链路过长。

## 决策

将 `createDocument` API 的入参从 `relativePath: string` 改为 `fileName: string` + `parentId?: string`，路径由后端自动计算。

### normalizeFileName

后端新增 `normalizeFileName()` 函数（`document.service.ts`）：

```
1. trim()
2. split(/[\\/]/).pop() → 只取文件名，丢弃路径前缀
3. replace 非法字符（非 \w、中文、-、_、.）为 _
4. 无 .md 后缀则补上
5. 空文件名默认 "untitled.md"
```

### 路径计算逻辑

```
if (parentId == null):
  relativePath = normalizedFileName          → 域顶层
else:
  parentDoc = findDocumentById(parentId)
  assert parentDoc != null && parentDoc.file_type == 'dir'
  relativePath = parentDoc.relative_path + '/' + normalizedFileName
```

### API 变更

**旧接口**（`POST /api/documents`）：

```json
{ "relativePath": "folder/sub/doc.md", "displayName": "...", "content": "..." }
```

**新接口**：

```json
{ "fileName": "doc.md", "parentId": "<folder-document-id>", "displayName": "...", "content": "..." }
```

`parentId` 可选，不传时文档置于域顶层。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/server/documents/document.service.ts` | 新增 `normalizeFileName()`；`createDocument` 参数从 `relativePath` 改为 `fileName` + `parentId`；新增路径自动计算逻辑 |
| `src/server/routes/documents.routes.ts` | POST route 参数验证从 `relativePath` 改为 `fileName` |
| `src/web/services/endpoints.ts` | `createDocumentApi` 入参类型从 `relativePath` 改为 `fileName` |
| `src/web/app/hooks/useCreateModal.ts` | 移除前端路径拼接逻辑，直接传 `fileName` + `parentId` |
| `src/server/documents/document.service.integration.test.ts` | 所有 `createDocument` 调用从 `relativePath` → `fileName` |
| `src/server/documents/tree-and-folders.test.ts` | 同上 |
| `fgbg-docs/api-reference.md` | 更新 API 文档 |
| `fgbg-docs/adr/003-api-path-calculation.md` | 本文 |

## 后果

### 正面

- 前端不再关心存储路径格式，只需提供文件名和父文件夹 ID。
- 路径格式统一由后端保证，减少非法路径入库。
- 文件名校验集中在一处（`normalizeFileName`），修改规则只需改一个函数。

### 负面

- `parentId` 必须对应一个 `file_type = 'dir'` 的文档，否则抛 400 错误。调用方需要确保 `parentId` 有效。
- 新增 `normalizeFileName` 逻辑，文件名中的非法字符被静默替换——如果前端有文件名回显，需要留意实际落盘名可能和用户输入不完全一致。

## 相关文档

- `api-reference.md` — 更新后的 API 文档
- `recent-changes.md` — 改动总结
