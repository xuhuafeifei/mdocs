# 目录树设计

## 核心原则

- `relative_path` 仅用于磁盘存储定位，不参与树逻辑
- 树结构由 `parent_id` 关系决定
- 目录（dir）在库表中真实存在；**`dir` 与自动创建的 `desc.md` 的 owner 均为创建者**，删除与改档等管理权同 `01`「仅 owner」；文件 `permission` 仍须满足**所在域**允许的档位集合（见 `01-permission-model.md`）

## Schema

`documents` 表新增：

- `parent_id TEXT` — 父目录的 document_id
- `type TEXT NOT NULL DEFAULT 'md'` — `'dir'` 或 `'md'`

## 目录（dir）

- `type='dir'` 的记录代表一个目录
- dir 本身不存内容，内容由其自动关联的 `desc.md` 承担
- 创建 dir 时，后端自动创建一条 `desc.md` 记录（`type='md'`，`parent_id` 指向该 dir）

## 树构建

- 按 `parent_id` 递归组织
- `type='dir'` → `TreeFolderNode`
- `type='md'` 且非 `desc.md` → `TreeDocumentNode`
- `desc.md` 不单独显示为文件节点，其内容作为文件夹点击时的编辑内容

## 创建接口

`POST /api/documents` 参数：

```ts
{ parentId: string | null, name: string, type: 'dir' | 'md', displayName?, content? }
```

- 前端传 `parentId + name + type`，不再自己拼 `relativePath`
- 后端根据 `parentId` 查到父 dir 的 `relative_path`，拼接出新路径创建文件
- `type='dir'` → 插 dir 记录，同时自动创建 `desc.md`
- `type='md'` → 插 md 记录

## 前端改造

- 树组件用 `documentId` 标识节点，废弃 `path` 字符串定位
- `selectedParentId` 替代 `selectedParentPath`
- 创建时传 `parentId + name + type`

## 级联删除（后续）

`DELETE /api/documents/:dirId`（dir 类型）→ 递归删除该 dir 下所有后代（子 dir + 子 md），同步删磁盘文件。