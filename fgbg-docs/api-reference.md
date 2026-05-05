# API 参考

> 本文回答：mdocs 提供了哪些 HTTP 端点、请求/响应格式、错误码。

## 约定

- **Base URL**：开发环境 `http://localhost:5173/api`（Vite 代理），生产环境同域名 `/api`。
- **认证**：请求头携带 `x-visitor-token`（原始 token）。
- **内容类型**：除文件上传外，均为 `application/json`。
- **响应格式**：统一包装为 `{ data?: T, error?: { code: string, message: string } }`。

## 端点清单

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 返回 `{ data: { status: "ok" } }` |

### 访客 (Visitors)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/visitors/register` | 注册新访客 |
| GET | `/api/visitors/me` | 获取当前访客信息 |
| GET | `/api/visitors` | 获取访客目录（用于邀请/成员选择） |

**`POST /api/visitors/register`**
- Body: `{ visitorName: string }`
- Response: `{ data: { visitorId: string, visitorName: string, token: string } }`
- 前端保存 `token` 到 `localStorage`，后续请求通过 `x-visitor-token` 发送。

### 域 (Domains)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/domains` | 列出所有域 |
| POST | `/api/domains` | 创建域 |
| PUT | `/api/domains/:domainId` | 重命名域 |
| PUT | `/api/domains/:domainId/permission` | 修改域类型 |
| DELETE | `/api/domains/:domainId` | 删除域 |
| GET | `/api/domains/:domainId/members` | 获取域成员列表 |
| PUT | `/api/domains/:domainId/members` | 批量设置域成员 |

**`POST /api/domains`**
- Body: `{ domainName: string, permission: string }`（permission: `public` | `restricted` | `private`）
- Response: `DomainSummary`

### 文档树 (Tree)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tree?domainId=` | 获取某域的文档树 |

- 返回 `TreeNode[]`，树结构由 `parent_id` 递归构建。
- `type='dir'` → 目录节点；`type='md'` → 文档节点；`desc.md` 内容作为目录的默认展示内容。

### 文档 (Documents)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/documents/:documentId` | 获取文档详情 |
| POST | `/api/documents` | 创建文档 |
| PUT | `/api/documents/:documentId` | 更新文档 |
| DELETE | `/api/documents/:documentId` | 删除文档 |
| GET | `/api/documents/:documentId/invites` | 获取文档邀请列表 |
| POST | `/api/documents/:documentId/invites` | 添加文档邀请 |
| DELETE | `/api/documents/:documentId/invites/:visitorId` | 移除文档邀请 |

**`POST /api/documents`**
- Body: `{ relativePath: string, displayName?: string, content: string, domainId?: string, permission?: number }`
- Response: `DocumentDetail`

**`PUT /api/documents/:documentId`**
- Body: `{ content: string, displayName?: string, permission?: number }`
- 后端会校验 content hash 冲突（乐观锁）。

### 附件 (Assets)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/assets/:assetId` | 获取附件文件 |
| POST | `/api/assets/upload` | 上传附件（FormData） |

**`POST /api/assets/upload`**
- Content-Type: `multipart/form-data`
- Fields: `file[]`（二进制文件）, `documentId`
- Response: `{ data: { succMap: { "原始文件名": "/api/assets/xxx" } } }`

### 域成员模板 (Domain Member Templates)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/domain-member-templates` | 列出模板 |
| POST | `/api/domain-member-templates` | 创建模板 |
| PUT | `/api/domain-member-templates/:id` | 更新模板 |
| DELETE | `/api/domain-member-templates/:id` | 删除模板 |

## 错误码

| Code | HTTP | 含义 |
|------|------|------|
| `NOT_FOUND` | 404 | API 路径不存在 |
| `DOC_NOT_FOUND` | 404 | 文档不存在 |
| `FORBIDDEN` | 403 | 无权访问 |
| `CONFLICT` | 409 | 内容哈希冲突（乐观锁失败） |
| `UNKNOWN` | 视情况 | 通用错误 |

## 前端 API 客户端

- **封装位置**：`src/web/services/client.ts`（底层 fetch + token 注入 + 错误处理）
- **业务接口**：`src/web/services/endpoints.ts`（按领域封装为函数）
- **上传例外**：`uploadAssetApi` 使用原生 `fetch` + `FormData`，手动注入 `x-visitor-token`，避免 `Content-Type: application/json`。
