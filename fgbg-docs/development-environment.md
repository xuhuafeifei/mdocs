# 开发环境

> 本文回答：如何在本地运行 mdocs、常用脚本、调试技巧、项目配置。

## 前置依赖

- **Node.js**：20+（建议用最新 LTS）
- **包管理器**：pnpm
- **SQLite**：系统自带（macOS/Linux）或安装 `better-sqlite3` 预编译二进制

## 安装

```bash
cd /Users/xuhuafei/github/mdocs
pnpm install
```

## 常用脚本

| 脚本 | 命令 | 说明 |
|------|------|------|
| 同时启动 | `pnpm dev` | 并行启动后端 + 前端（等价于 `pnpm dev:server & pnpm dev:web`） |
| 仅后端 | `pnpm dev:server` | `tsx watch src/server/main.ts`，监听 `http://localhost:4000` |
| 仅前端 | `pnpm dev:web` | `vite`，监听 `http://localhost:5173`，代理 `/api` → `localhost:4000` |
| 强制刷新 | `pnpm dev:web:fresh` | `vite --force`，清除 Vite 缓存 |
| 类型检查 | `pnpm typecheck` | 同时检查服务端 + 前端 TypeScript |
| 测试 | `pnpm test` | `vitest run` |
| 测试监听 | `pnpm test:watch` | `vitest`（交互式） |
| 构建 | `pnpm build` | `build:web` + `build:server` |
| 构建前端 | `pnpm build:web` | `vite build` → `dist/web/` |
| 构建后端 | `pnpm build:server` | `tsc -p tsconfig.server.json` → `dist/server/` |
| 生产启动 | `pnpm start` | `node dist/server/main.js` |
| CLI | `pnpm mdocs` | `tsx src/server/cli/main.ts` |

## 开发配置

### Vite 代理

开发时前端端口 5173，后端 4000。Vite 配置中已将 `/api` 代理到 `localhost:4000`，因此前端代码中直接写 `/api/xxx` 即可。

### 运行时数据

```
~/.mdocs/
  data.sqlite
  files/docs/
  files/assets/
  logs/
```

- 数据目录可在 `src/server/config/index.ts` 中调整。
- 删除 `~/.mdocs/data.sqlite` 可重置数据库（会丢失所有元数据，但 Markdown 文件仍在磁盘）。

### 环境变量

- 项目未使用 `.env` 文件（无 `dotenv` 依赖）。
- 配置集中放在 `src/server/config/index.ts`，通过环境变量或默认值读取。

## 调试技巧

### 后端调试

1. `pnpm dev:server` 使用 `tsx watch`，修改后自动重启。
2. 在 `src/server/` 任意位置打 `console.log` 或使用 `useLogger("xxx")`（`src/server/logger/logger.ts`）。
3. 日志输出到控制台 + `~/.mdocs/logs/`。

### 前端调试

1. `pnpm dev:web` 开启 Vite HMR。
2. 浏览器 DevTools → Network 查看 `/api` 请求。
3. `src/web/services/client.ts` 中可打开 `console.log` 查看请求/响应。

### 数据库调试

```bash
# 直接连接 SQLite
sqlite3 ~/.mdocs/data.sqlite

# 常用查询
.tables
SELECT * FROM documents LIMIT 5;
SELECT * FROM visitors WHERE disabled_at IS NULL;
```

## 代码规范

- **TypeScript**：严格模式（`strict: true`）。
- **Import 后缀**：ESM 要求，导入时写 `.js`（如 `import { x } from "./foo.js"`），即使源文件是 `.ts`。
- **无 ESLint/Prettier 配置**：目前靠人工保持风格一致。

## 添加新 API 的流程

1. **Shared 类型**：在 `src/shared/types/` 新增类型定义。
2. **Repository**：在 `src/server/db/repositories/` 添加数据访问方法。
3. **Service**（可选）：在 `src/server/documents/` 或 `src/server/domains/` 添加业务逻辑。
4. **路由**：在 `src/server/routes/` 新增 `*.routes.ts`，在 `app.ts` 注册。
5. **前端接口**：在 `src/web/services/endpoints.ts` 添加封装函数。
6. **前端组件**：在 `src/web/app/` 添加/修改组件。
7. **测试**：补充单元测试（`*.test.ts`）或集成测试（`*.integration.test.ts`）。
