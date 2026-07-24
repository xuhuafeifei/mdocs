# map — backend

人读长文：[`../archive/architecture-overview.md`](../archive/architecture-overview.md)、[`database-schema.md`](../archive/database-schema.md)、[`api-reference.md`](../archive/api-reference.md)、[`search-implementation.md`](../archive/search-implementation.md)

### 启动与组装

- **关键词**：`buildApp` `main` `Express`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/main.ts` | 启动入口 |
  | `src/server/app.ts` | `buildApp` |
  | `src/server/config/` | 运行时配置 |

### DB / Schema / Repository

- **关键词**：`sqlite` `schema` `repository` `better-sqlite3`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/db/connection.ts` | `getDb` |
  | `src/server/db/schema.ts` | 表定义 |
  | `src/server/db/repositories/` | 各 repo |

### 文档 / 树 / 存储

- **关键词**：`document` `tree` `file-store` `relativePath`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/documents/document.service.ts` | 文档业务 |
  | `src/server/documents/tree.service.ts` | 树构建 |
  | `src/server/storage/file-store.ts` | `readDocument` / `writeDocument` |
  | `src/shared/docPath.ts` | 路径校验 |

### 路由

- **关键词**：`routes` `/api`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/routes/` | `*.routes.ts` |

### 搜索

- **关键词**：`FTS5` `search` `index`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/search/document-index-manager.ts` | 索引管理 |
  | `src/server/search/search.service.ts` | 检索 |

### 域 / CLI / 迁移

- **关键词**：`domain` `personal` `visitor migrate` `cli`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/domains/personal-domain.service.ts` | 个人域 |
  | `src/server/cli/main.ts` | CLI 入口 |
  | `src/server/migrations/visitor-migration.service.ts` | 访客迁移 |
