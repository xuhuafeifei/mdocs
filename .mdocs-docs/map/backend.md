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

- **关键词**：`document` `tree` `file-store` `relativePath` `parent_id` `move`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/documents/document.service.ts` | 文档业务（拟增 `moveDocument`） |
  | `src/server/documents/tree.service.ts` | 树构建 |
  | `src/server/storage/file-store.ts` | `readDocument` / `writeDocument`（拟增 rename） |
  | `src/shared/docPath.ts` | 路径校验 |
- **需求**：[`../requirements/document-move/`](../requirements/document-move/)（已同意）

### 路由

- **关键词**：`routes` `/api`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/routes/` | `*.routes.ts` |

### 上手 Agent / Model 配置

- **关键词**：`agent` `DeepSeek` `agent_model_configs` `onboarding` `session` `get_document`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/agent/Config/config.ts` | `getVisitorAgentConfig` `upsertVisitorAgentConfig` |
  | `src/server/agent/Agent/run.ts` | `getAgentStatus` `runOnboardingChat` |
  | `src/server/agent/Agent/run-pi-agent.ts` | `runPiAgent`（subscribe / prompt / bindAgentEvents） |
  | `src/server/agent/Agent/stream-events.ts` | `AgentStreamEvent` |
  | `src/server/agent/Agent/tool-ui-effects.ts` | `createToolUiEffectsHandler`（tool→SSE） |
  | `src/server/agent/Agent/tool-deps.ts` | `ToolDeps` |
  | `src/server/agent/Agent/session-manager.ts` | `listSessions` `createSession` `openSession` |
  | `src/server/agent/Agent/tools-template.ts` | `manualTools` `accountTools` `choiceTools` `overwriteTools` `codingWriteTools` |
  | `src/server/agent/Agent/tools-registry.ts` | `createToolsForMode(mode, deps)` |
  | `src/server/agent/Agent/tools-choice.ts` | `askUserChoiceTool` |
  | `src/server/agent/Agent/tools-overwrite.ts` | `overwriteDocumentTool` |
  | `src/server/agent/Agent/almost-empty.ts` | `isAlmostEmptyDocumentText` |
  | `src/server/agent/Agent/choice-pending.ts` | `waitForUserChoice` `resolveUserChoice` |
  | `src/server/agent/Agent/tools-documents.ts` | `searchDocumentsTool` `getDocumentTool` 等单个 tool |
  | `src/server/agent/Agent/tools-domains.ts` | `listDomainsTool` `createDomainTool` 等 |
  | `src/server/agent/Agent/system-prompt.ts` | `buildSystemPrompt` |
  | `src/server/routes/agent.routes.ts` | `buildAgentRouter`（含 `/choice` `/sessions` `/session/open`） |
  | `src/server/db/repositories/agent-model-config.repo.ts` | `findAgentModelConfigByOwner` |
  | `src/web/app/AgentConfigPanel.tsx` | `AgentConfigPanel` |
  | `src/web/app/AgentUserSkillsPanel.tsx` | 私人 skill CRUD |
  | `src/web/app/AgentSkillRefPicker.tsx` | 对话引用 skill |
  | `src/web/app/AgentChatPanel.tsx` | 历史列表 / 「+」新建 |
  | `src/server/db/repositories/agent-user-skill.repo.ts` | `listAgentUserSkillsByOwner` |
  | `src/server/agent/Agent/user-skills.ts` | `resolveSkillExpandBlocks` `formatSkillExpandBlock` |
  | `src/server/agent/Agent/hydrate-messages.ts` | `hydrateSessionMessagesToPi` |
- **需求**：[`../requirements/user-agent-skills/`](../requirements/user-agent-skills/)（已同意）

### 搜索

- **关键词**：`FTS5` `search` `index`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/search/document-index-manager.ts` | 索引管理 |
  | `src/server/search/search.service.ts` | 检索 |

### 域 / CLI / 迁移

- **关键词**：`domain` `personal` `visitor migrate` `cli` `mdocs update`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/domains/personal-domain.service.ts` | 个人域 |
  | `src/server/cli/main.ts` | CLI 入口 |
  | `src/server/cli/self-update.ts` | `runSelfUpdate`（npmmirror 原地升级，保留 node_modules） |
  | `src/server/migrations/visitor-migration.service.ts` | 访客迁移 |
