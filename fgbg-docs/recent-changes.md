# 最近改动（续）

## 3. mdocs-cli 客户端（外部仓库）

### 仓库地址

`https://github.com/xuhuafeifei/mdocs-cli.git`，CLI 入口 `~/.mdocs-cli/mdocs.mjs`

### 命令

| 命令 | 用途 |
|------|------|
| `search --q <关键词> [--domain <id>] [--topn <n>]` | FTS5 全文检索 |
| `get <文档ID>` | 读取文档详情 |
| `create --name <文件名.md> --content <正文> [--domain <id>] [--parent <目录ID>]` | 创建文档 |
| `update <文档ID> --content <新正文> [--title <新标题>]` | 更新文档内容+标题 |
| `domains` | 列出当前 token 可访问的域 |
| `mkdir --domain <id> --name <目录名> [--parent <目录ID>]` | 创建目录 |

### 认证

- 请求头 `x-cli-token`，mdocs 中间件同时支持 `x-visitor-token` 和 `x-cli-token`
- Token 在 mdocs 设置页手动创建，服务端存 SHA-256 哈希

### 关键交互模式

- 用户给 `http://localhost:5173/doc/<文档ID>` → agent 先 `get` 判断意图（修改 vs 挂载到目录）
- 路径 `___desc___.md` 标识目录的描述页，挂载时应传目录节点 ID 而非文档 ID 作为 `parentId`
- 目录节点 ID 通过 `GET /api/tree?domainId=xxx` 获取

---

## 4. 显式目录模型 + parentId 全链路

### 涉及文件

| 文件 | 做什么 |
|------|--------|
| `src/server/db/schema.ts` | documents 表新增 `type`('md'/'dir')、`parent_id`；folders 表废弃；新增 cli_tokens 表、audit_log 表 |
| `src/server/documents/tree.service.ts` | 树构建改为纯 `parent_id` 递归，不再依赖 `relative_path` |
| `src/server/documents/document.service.ts` | `createDocument` 支持 `parentId`；`normalizeFileName()` 路径计算 |
| `src/server/routes/documents.routes.ts` | POST create 参数 `fileName` + `parentId`（替代 `relativePath`） |
| `src/server/routes/folders.routes.ts` | 目录 CRUD 路由 |
| `src/server/routes/tree.routes.ts` | `GET /api/tree?domainId=` |
| `src/server/routes/assets.routes.ts` | 附件上传/下载路由 |
| `src/server/routes/domains.routes.ts` | 域 CRUD + 成员管理 |
| `src/server/routes/visitors.routes.ts` | 访客注册 + 列表 |
| `src/server/routes/domain-member-templates.routes.ts` | 域成员模板 CRUD |
| `src/server/domains/personal-domain.service.ts` | 访客注册时自动创建个人域 |
| `src/server/identity/token.ts` | Token 生成工具（高熵 base64url） |
| `src/server/logger/logger.ts` | 日志模块 |
| `src/server/middleware/document-auth.middleware.ts` | 文档级别权限中间件 |
| `src/server/storage/file-store.ts` | 文件存储路径改为 `~/.mdocs/files/docs/` + `~/.mdocs/files/assets/` |
| `src/server/migrations/visitor-migration.service.ts` | 访客迁移脚本 |
| `src/server/cli/main.ts` | CLI 工具入口 |
| `src/shared/docPath.ts` | 文档路径工具函数 |
| `src/shared/domainUi.ts` | 域 UI 显示工具 |
| `src/shared/folderDesc.ts` | 目录描述文档工具 |
| `src/shared/personalDomain.ts` | 个人域路径处理 |
| `src/shared/storagePath.ts` | 存储路径处理 |
| `src/web/app/hooks/useCreateModal.ts` | 新建文档/目录模态框 |
| `src/web/app/DocumentEditor.tsx` | 编辑器（Lexical + LobeHub UI） |
| `src/web/app/DocumentTree.tsx` | 侧边栏文档树（递归渲染） |
| `src/web/app/DomainSelect.tsx` | 域选择下拉组件 |
| `src/web/app/SettingsPage.tsx` | 设置页（含 CLI Token 管理 UI） |
| `src/web/app/ConfirmDialog.tsx` | 通用确认弹窗组件 |
| `src/web/app/Router.tsx` | 路由配置 |
| `src/web/app/actions.ts` | 编辑器操作定义 |
| `src/web/app/Toolbar.tsx` | 编辑器工具栏 |
| `src/web/app/TreeContextMenu.tsx` | 文档树右键菜单 |
| `src/web/services/endpoints.ts` | 全部 API 封装函数 |
| `src/web/services/domainsBootstrap.ts` | 域启动引导初始化 |
| `src/web/storage/drafts.ts` | IndexedDB 草稿缓存 |
| `src/web/app/hooks/useAutoSave.ts` | 自动保存 hook |
| `src/web/app/hooks/useAutoPublish.ts` | 自动发布 hook |
| `src/web/app/hooks/usePublishGuard.ts` | 发布守卫 hook |
| `src/web/app/hooks/useDomainManagement.ts` | 域管理 hook |

### 目录模型

```
documents 表:
  type: 'md' | 'dir'       ← 新增
  parent_id: UUID | null    ← 新增，自引用
  relative_path: string     ← 后端自动计算，不再支持用户手动传
  folder_id: UUID | null    ← （废弃中）

树构建：parent_id 递归，不再解析路径字符串
```

### 创建文档流程

```
create({ fileName, parentId?, ... })
  → normalizeFileName(fileName)         // 去空格/非法字符/补.md
  → parentId 存在则查父节点（必须是 dir 类型）
  → relativePath = parent.relative_path + '/' + fileName
  → insert into documents (type='md', parent_id, relative_path, ...)
```

---

## 5. Markdown → Lexical JSON（后端转换）

### 涉及文件

| 文件 | 做什么 |
|------|--------|
| `src/server/documents/markdown-to-lexical.ts` | Markdown 转 Lexical JSON 核心实现（基于 marked + 自定义 lexer/parser） |
| `src/server/documents/markdown-to-lexical.test.ts` | 覆盖所有节点类型的快照测试 |
| `src/server/documents/document.service.ts` | `createDocument` 接收 `contentFormat: 'markdown'` 参数，后端调用 `markdownToLexical` 转换后入库 |
| `src/server/routes/documents.routes.ts` | POST create / PUT update 支持 `contentFormat` 字段 |
| `src/shared/types/document.ts` | 新增 `contentFormat?: 'lexical' | 'markdown'` 类型 |
| `src/server/test-utils/lexical-structure-compare.ts` | Lexical 结构比较工具（测试用） |
| `src/server/test-utils/lexical-structure-compare.test.ts` | 测试 |
| `src/server/test-utils/markdown-vs-lobe-golden.test.ts` | Markdown vs Lobe 标准编辑器输出的对比测试 |

### 转换能力

- 标题 h1-h6、段落、换行
- 粗体/斜体/删除线/行内代码/超链接
- 有序/无序列表（支持嵌套）
- 代码块（保留语言标识）
- 引用块
- 分隔线
- 表格（含表头、合并、背景色）
- Lexical 的 `cursor` 占位节点
- 转义字符处理

---

## 6. CLI Token 管理

### 涉及文件

| 文件 | 做什么 |
|------|--------|
| `src/server/db/repositories/cli-token.repo.ts` | CLI Token 的数据库操作（创建、列表、吊销） |
| `src/server/db/schema.ts` | `cli_tokens` 表定义（token_id, visitor_id, token_hash, name, revoked, created_at） |
| `src/server/identity/cli-token.service.ts` | Token 签发（生成高熵 token + SHA-256 哈希存储）/验证/吊销 |
| `src/server/identity/auth.middleware.ts` | 同时支持 `x-visitor-token` 和 `x-cli-token` 两种认证头 |
| `src/server/routes/cli-tokens.routes.ts` | `GET/POST /api/cli/tokens`（列表/创建）、`DELETE /api/cli/tokens/:id`（吊销） |
| `src/web/app/SettingsPage.tsx` | 设置页 CLI Token 管理 UI：创建、查看、吊销、复制 |

### 认证策略

```
authMiddleware:
  1. 取 x-visitor-token → SHA-256 → 查 visitors 表
  2. 如果没匹配，取 x-cli-token → SHA-256 → 查 cli_tokens 表（未吊销）
  3. 都不匹配 → 401 INVALID_TOKEN
```

### Note

- mdocs 的前端草稿/自动保存/自动发布逻辑见 `src/web/storage/drafts.ts` 和 `src/web/app/hooks/` 目录。
- 每个前端组件都有详细的 JSDoc 注释，可以直接看源码。
