# ADR-002：显式目录模型 + parentId 全链路打通

> 状态：accepted
> 日期：2026-05-06
>  superseded by: —

## 上下文

重构前，mdocs 的文件夹是隐式的——通过 `relative_path` 按 `/` 切割推导，无法独立存在（空目录不可能），且不同域的同名文件会冲突。重构后发现两个遗漏：

1. **创建文档时没传 `parentId`**：前端只拼接了 `relativePath`，但没在数据库中建父子关系，导致树构建时文档挂在根级而非父文件夹下
2. **TreeFolderNode 缺少 `documentId`**：前端无法通过父路径查到文件夹的数据库 ID，无法传 `parentId`

## 决策

### 1. TreeFolderNode 暴露 `documentId`

`src/shared/types/tree.ts` 的 `TreeFolderNode` 新增 `documentId: string` 字段。`tree.service.ts` 建节点时直接从 `row.document_id` 填充。

这样前端可以通过 `findFolderIdByPath(tree, parentPath)` 查找父文件夹的数据库 ID。

### 2. useCreateModal 传 parentId

`src/web/app/hooks/useCreateModal.ts` 中创建文档时：
1. 通过 `findFolderIdByPath(tree, effectiveParent)` 查找父文件夹 ID
2. 将 `parentId` 传给 `createDocumentApi`

### 3. createFolder 补全细节

`src/server/routes/folders.routes.ts` 中创建文件夹时：
- 调用 `normalisePathSegmentForStorage(params.name)` 得到存储用路径（空格转下划线等）
- `displayName` 保留用户原始输入（`params.name`）
- `relative_path` 使用规范化后的存储路径
- **始终创建** `___desc___.md` 文件，内容为 `params.description ?? \`# ${params.name}\``

### 4. endpoints.ts 类型补全

`createDocumentApi` 的 input 类型新增 `parentId?: string`。

## 数据流

创建文档的完整链路：

```
前端 useCreateModal
  → findFolderIdByPath(tree, parentPath) 得到 folderId
  → createDocumentApi({ relativePath, ..., parentId: folderId })
  → POST /api/documents { relativePath, ..., parentId }
  → documents.routes.ts 从 body 取 parentId
  → document.service.createDocument({ ..., parentId })
  → insertDocument({ ..., parentId: params.parentId ?? null })
  → SQLite documents.parent_id 字段落库
  → tree.service.buildTreeFromRows() 按 parent_id 建树
  → 前端显示正确层级
```

## 后果

### 正面
- 文档的 `parent_id` 正确指向父文件夹，树构建不再依赖路径切割
- 前端可以通过树节点的 `documentId` 直接引用文件夹
- 文件夹创建时始终有 `___desc___.md`，支持文件夹描述功能

### 测试覆盖
- `document.service.integration.test.ts`：新增测试验证 `parentId` 落库正确
- `tree-and-folders.test.ts`：已有 21 个测试覆盖文件夹 CRUD 和树构建

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/shared/types/tree.ts` | TreeFolderNode 加 `documentId` |
| `src/server/documents/tree.service.ts` | 建文件夹节点时填充 `documentId` |
| `src/web/app/hooks/useCreateModal.ts` | 加 `findFolderIdByPath`，传 `parentId` |
| `src/web/services/endpoints.ts` | `createDocumentApi` 类型加 `parentId` |
| `src/server/routes/folders.routes.ts` | 导入 `normalisePathSegmentForStorage`，保留 displayName，始终创建 desc 文件 |
| `src/server/documents/document.service.integration.test.ts` | 新增 parentId 落库测试 |
