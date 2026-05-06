# 身份与访问控制

> 本文回答：mdocs 如何识别访客、Token 如何流转、五级权限如何计算、域类型如何约束文档档位。

## 访客身份模型

### 核心原则

- **无账号系统**：没有注册/登录/密码，只有「访客（Visitor）」。
- **昵称 + Token**：用户输入一个昵称，后端生成 UUID（`visitor_id`）+ 高熵随机字符串（`visitor_token`）。
- **服务端只存哈希**：原始 token 永不落库，只存 `SHA-256(token)`。
- **浏览器保存原文**：`localStorage` 存原始 token，每次请求通过 `x-visitor-token` header 发送。

### 注册流程

```
用户输入昵称
  → POST /api/visitors/register
    → 后端生成 visitor_id + visitor_token
      → 返回 { visitorId, visitorName, token }
        → 前端 localStorage.setItem("visitor_token", token)
```

### 鉴权中间件

- **位置**：`src/server/identity/auth.middleware.ts`
- **行为**：
  1. 从 `x-visitor-token` header 读取原始 token。
  2. 计算 `SHA-256(token)`。
  3. 查 `visitors` 表匹配 `visitor_token_hash`。
  4. 若找到且未被 `disabled`，将 `req.visitor` 附加到请求对象；否则 `req.visitor = null`（匿名）。

### 访客合并（Migration）

- **场景**：浏览器缓存被清除，用户注册了新的 visitor。
- **工具**：`pnpm mdocs visitor migrate --from OLD --to NEW --confirm`
- **位置**：`src/server/migrations/visitor-migration.service.ts`
- **行为**：
  1. 备份 SQLite 文件。
  2. 在事务中更新 `documents.owner_visitor_id`、`created_by`、`updated_by` 等。
  3. 将旧 visitor 标记为 `disabled_at = now()`，`merged_into_visitor_id = NEW`。
  4. 写入 `visitor_migrations` 和 `audit_logs`。

## 五级权限模型

- **源码位置**：`src/server/access/access-control.ts`

### 档位定义

| 数值 | 常量 | 名称 | 读范围 | 写范围 |
|------|------|------|--------|--------|
| 0 | `Permission.PRIVATE` | private | owner | owner |
| 1 | `Permission.DOMAIN_READ` | domain_read | 域成员 | owner |
| 2 | `Permission.DOMAIN_WRITE` | domain_write | 域成员 | 域成员 |
| 3 | `Permission.PUBLIC_READ` | public_read | 任何人 | owner |
| 4 | `Permission.PUBLIC_WRITE` | public_write | 任何人 | 任何人 |

### 域类型 × 允许的文档档位

| 域类型 | 允许的文档 `permission` | 说明 |
|--------|------------------------|------|
| `public` | 仅 `3`、`4` | 公开域，文档必须对所有人可见 |
| `restricted` | 仅 `1`、`2` | 受限域，文档仅对域成员可见 |
| `private` | `0`~`4` 全部 | 私有域，owner 自由设置；UI 文案做风险提示 |

### 核心函数

#### `canReadDocument(row, visitorId, domainInfo): boolean`

1. **owner** → 永远可读。
2. **未登录**（`visitorId` 为空）→ 仅 `public_read` / `public_write`（3/4 档）可读。
3. **`public` 域** → 仅 3/4 档，任何人可读。
4. **`restricted` 域** → 仅 1/2 档；域成员可读；非成员靠 `document_invites`。
5. **`private` 域** → 按五档实际语义：
   - `private(0)` → 仅 owner（已排除），其他人靠 invite。
   - `domain_read`/`domain_write` → private 域只有 owner 一名成员，非 owner 靠 invite。
   - `public_read`/`public_write` → 任何人可读。

#### `canEditDocument(row, visitorId, domainInfo): boolean`

1. **owner** → 永远可写。
2. **未登录** → 仅 `public_write(4)` 可写。
3. **`public` 域** → 仅 `public_write(4)` 允许任何人写。
4. **`restricted` 域** → 仅 `domain_write(2)` 且是域成员可写；非成员靠 invite（需 `permission === 'edit'`）。
5. **`private` 域** →
   - `private(0)` / `domain_read(1)` / `domain_write(2)` / `public_read(3)` → 均不可写（owner 已在第 1 步放行）。
   - `public_write(4)` → 任何人可写。

#### `assertDocumentAccess(documentId, visitorId, action)`

- 统一鉴权入口，自带 DB 查询。
- `action: 'read' | 'edit' | 'delete'`。
- **删除**：始终仅 owner 可删。
- 鉴权失败抛 `DocumentError`（403/404），由路由层 catch。

### 域入口（Tree 级别）

- `canEnterDomainTree` 等函数控制访客是否有权看到某域的树结构。
- `private` 域：非 owner 看不到树入口。
- `restricted` 域：非成员看不到树入口（除非被某文档 invite）。

### Invite 机制

- **位置**：`document_invites` 表。
- **语义**：对圈外访客单独授予 `read` 或 `edit`。
- **约束**：与域成员互斥。已是域成员的人不能被 invite。
- **检查时机**：每次读/写前重算，不缓存。

## CLI Token

- **用途**：命令行工具（CLI）和 Agent（如 Claude Code）使用的身份令牌，继承访客的所有权限。
- **与 Web Token 的关系**：Web 端使用 `x-visitor-token`（创建访客时生成），CLI 端使用 `x-cli-token`（在设置页手动创建）。两者在服务端最终解析为同一个 `visitor_id`，业务代码无需区分来源。
- **鉴权中间件**（`src/server/identity/auth.middleware.ts`）：
  1. 先尝试 `x-visitor-token`。
  2. 若无效，再尝试 `x-cli-token`。
  3. 均失败则返回 401。
- **Token 强度**：32 字节随机字符串（`crypto.randomBytes(32).toString("base64url")`），与 Web Token 同级。
- **存储**：服务端只存 `SHA-256(token)`，原始 token 仅在创建时展示一次。
- **吊销**：重置操作会吊销所有已有 token 并生成新 token。

## 安全要点

- Token 是高熵随机字符串，不暴露给前端逻辑（除保存在 localStorage）。
- 后端仅比较哈希，即使 DB 泄露也无法直接伪造请求。
- `disabled` 的 visitor 无法通过鉴权中间件。
- `x-visitor-token` 通过 header 而非 cookie 发送，不受 CSRF 困扰（但需注意 XSS 窃取 localStorage）。
