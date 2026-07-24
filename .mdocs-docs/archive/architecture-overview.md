# 架构总览

> 本文回答：mdocs 的系统边界、模块划分、数据流、运行时目录布局。

## 系统边界

mdocs 是一个面向小团队的 Markdown 知识库，核心特征：

- **无账号系统**：基于访客身份（Visitor）+ Token 的轻量级鉴权。
- **域（Domain）隔离**：文档按域分组，域有 `public` / `restricted` / `private` 三种类型。
- **Markdown 原生**：.md 文件为主存储，SQLite 仅存元数据。
- **本地或小团队服务器**：单进程部署，前端静态资源由 Express 一并托管。

## 模块划分

```
src/
  server/    ← Node.js 后端
  web/       ← Vite + React 前端
  shared/    ← 前后端共享的类型定义和工具
```

### 后端 (`src/server/`)

| 目录 | 职责 | 关键文件 |
|------|------|----------|
| `main.ts` | 启动入口：配置 → buildApp → listen | `src/server/main.ts` |
| `app.ts` | Express 应用组装：中间件、路由注册、静态文件托管 | `src/server/app.ts` |
| `config/` | 运行时配置（端口、数据目录等） | `src/server/config/index.ts` |
| `db/` | SQLite 连接、Schema、Repository 层 | `src/server/db/connection.ts`, `schema.ts`, `repositories/*.ts` |
| `routes/` | Express Router，按资源拆分 | `src/server/routes/*.routes.ts` |
| `access/` | 统一访问控制：五级权限 + invite | `src/server/access/access-control.ts` |
| `identity/` | 访客注册、Token 签发与校验 | `src/server/identity/auth.middleware.ts`, `visitor.service.ts` |
| `documents/` | 文档业务逻辑（CRUD、树构建） | `src/server/documents/document.service.ts`, `tree.service.ts` |
| `search/` | FTS5 全文索引与检索 | `src/server/search/document-index-manager.ts`, `search.service.ts` |
| `domains/` | 域管理 | `src/server/domains/personal-domain.service.ts` |
| `storage/` | 文件系统读写（Markdown、附件） | `src/server/storage/` |
| `middleware/` | Express 通用中间件 | `src/server/middleware/` |
| `cli/` | 命令行工具（访客迁移等） | `src/server/cli/main.ts` |
| `migrations/` | 数据迁移脚本 | `src/server/migrations/visitor-migration.service.ts` |
| `types/` | 后端独占类型 | `src/server/types/` |

### 前端 (`src/web/`)

| 目录 | 职责 | 关键文件 |
|------|------|----------|
| `main.tsx` | 应用挂载：React + BrowserRouter + LobeHub UI | `src/web/main.tsx` |
| `app/` | 页面级组件和核心 UI | `src/web/app/App.tsx`, `DocumentEditor.tsx`, `DocumentTree.tsx` 等 |
| `services/` | API 客户端封装 | `src/web/services/endpoints.ts`, `client.ts` |
| `hooks/` | React Hooks | `src/web/app/hooks/` |
| `i18n/` | 国际化 | `src/web/i18n/` |
| `styles/` | 全局样式 | `src/web/styles/global.css` |
| `storage/` | 前端本地存储 | `src/web/storage/` |

### 共享层 (`src/shared/`)

- **类型定义**：前后端共用，避免重复声明。
- **关键文件**：`src/shared/types/document.ts`, `visitor.ts`, `tree.ts`, `domain.ts` 等。

## 数据流

### 运行时数据目录

```
~/.mdocs/
  data.sqlite          ← SQLite 数据库
  files/
    docs/              ← Markdown 文件（按 relative_path 存储）
    assets/            ← 上传的附件
  logs/                ← 运行日志
```

> `domain_id` 是逻辑分组，不出现在磁盘路径中。移动文档到不同域只改库，不移动文件。

### 请求生命周期

```
Browser
  → Vite dev server (dev) / Express static (prod)
    → /api/* 进入 Express
      → authMiddleware（从 x-visitor-token 解析访客身份）
        → Router → Service → Repository → SQLite
          → Service 返回 → Router res.json()
            → 前端 services/endpoints.ts 接收 → React 组件更新
```

### 身份流程

1. 首次访问：前端弹出昵称输入 → `POST /api/visitors/register`。
2. 后端生成 `visitor_id`（UUID）+ 高熵 `visitor_token`。
3. 浏览器保存 `visitor_token` 原文；后端只存 `SHA-256(token_hash)`。
4. 后续请求：前端在 `x-visitor-token` header 中携带原文，后端哈希后查库。

## 构建与部署

| 脚本 | 作用 |
|------|------|
| `pnpm dev:server` | 启动后端（`tsx watch`，端口 4000） |
| `pnpm dev:web` | 启动 Vite 前端（端口 5173，代理 `/api` 到 4000） |
| `pnpm build` | 前端 `vite build` + 后端 `tsc` |
| `pnpm start` | 运行 `dist/server/main.js`，Express 同时托管前端静态资源和 API |

生产部署时，整个应用是单进程：Express 既处理 `/api` 又 `express.static()` 托管 `dist/web/`。
