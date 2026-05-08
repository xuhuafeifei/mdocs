# fgbg-docs — 开发文档地图

> 目标读者：AI 助手（代码检索、重构、故障排查）。
> 编写原则：单文件单主题、显式交叉引用、表格化、路径精确到 `src/`。

## 快速定位

| 我想了解…… | 读这篇 |
|-----------|--------|
| 项目整体架构、技术栈、数据流 | [`architecture-overview.md`](./architecture-overview.md) |
| 数据库表结构、字段含义、索引、迁移策略 | [`database-schema.md`](./database-schema.md) |
| HTTP API 端点清单、请求/响应类型、错误码 | [`api-reference.md`](./api-reference.md) |
| 前端目录组织、关键组件、状态管理、路由 | [`frontend-structure.md`](./frontend-structure.md) |
| 访客身份机制、Token 生命周期、五级权限模型 | [`auth-and-access-control.md`](./auth-and-access-control.md) |
| 如何本地运行、构建、调试、常用脚本 | [`development-environment.md`](./development-environment.md) |
| 测试分层、运行方式、关键用例 | [`testing-strategy.md`](./testing-strategy.md) |
| 与 `markdown-docs` 的代码隔离红线 | [`clean-room-policy.md`](./clean-room-policy.md) |
| 重大技术决策的历史记录 | [`adr/`](./adr/) |

## 项目坐标

- **名称**：`mdocs` — Markdown knowledge base for small teams
- **仓库**：`/Users/xuhuafei/github/mdocs`
- **使用文档**（用户侧）：`~/github/mdocs-site/docs`
- **开发草稿**（AI 协作过程稿）：`fgbg/`（不被 git 跟踪）
- **技术栈**：TypeScript 全栈、Vite + React 前端、Express 后端、SQLite（better-sqlite3）

## 目录结构约定

```
fgbg-docs/
  README.md                  ← 你在这里
  <主题>.md                  ← 按主题拆分的开发文档
  adr/
    README.md                ← ADR 索引
    NNN-<决策标题>.md        ← 单条技术决策记录
```

- 文件名即主题，不含版本号（版本控制由 git 负责）。
- 每篇文档顶部用一句话说明「本文回答什么问题」。
- 涉及代码时给出相对路径，如 `src/server/db/schema.ts`。
