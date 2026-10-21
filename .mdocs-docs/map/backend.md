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

- **关键词**：`document` `tree` `file-store` `relativePath` `parent_id` `move` `folder subtree`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/documents/document.service.ts` | 文档业务（含 html raw / FTS·图谱政策门控）；`removeDocument` recovery / `restoreDocumentFromAudit` / `listDeletedDocuments`；`moveDocument`（含 `dir` 子树，图谱隐藏文件删除）；`listDocumentCommits` / `restoreDocumentVersion` |
  | `src/server/documents/tree.service.ts` | `buildDocumentTree` `buildFolderSubtree` |
  | `src/server/storage/file-store.ts` | `readDocument` / `writeDocument`（拟增 rename） |
  | `src/server/db/repositories/audit.repo.ts` | `insertAuditLog` `findAuditById` `listDocumentDeleteAuditsByActor` |
  | `src/server/routes/documents.routes.ts` | `GET /deleted` `POST /restore`（须在 `/:documentId` 前） |
  | `src/shared/docPath.ts` | 路径校验（`.md` / `.html` / `.json`） |
  | `src/shared/file-type-policy.ts` | file_type 政策表 + 派生查询 |
  | `src/shared/file-types.ts` | `FILE_TYPE` 常量 |
  | `src/shared/types/tree.ts` | `TreeNode` `FolderSubtreeNode` |
- **需求**：[`../requirements/document-move/`](../requirements/document-move/)；[`../requirements/folder-subtree/`](../requirements/folder-subtree/)；[`../requirements/html-documents/`](../requirements/html-documents/)；[`../requirements/document-delete-recovery/`](../requirements/document-delete-recovery/)

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
  | `src/server/agent/Agent/run-manager.ts` | `startAgentRun` `subscribeAgentRun` `cancelAgentRun`（SSE 解耦后台跑） |
  | `src/server/agent/Agent/run-store.ts` | run meta / events JSONL / 重启 interrupted |
  | `src/server/agent/Agent/stream-events.ts` | `AgentStreamEvent` |
  | `src/server/agent/Agent/tool-ui-effects.ts` | `createToolUiEffectsHandler`（tool→SSE） |
  | `src/server/agent/Agent/tool-deps.ts` | `ToolDeps` |
  | `src/server/agent/Agent/session-manager.ts` | `listSessions` `createSession` `openSession` `renameSession` `setSessionPinned`（`domainId` / `pinned`） |
  | `src/server/agent/Agent/tools-template.ts` | `manualTools` `accountTools` `choiceTools` `overwriteTools` `codingWriteTools` |
  | `src/server/agent/Agent/tools-web.ts` | `web_search` / `web_fetch`（仅 `deepseekWeb` 注入时） |
  | `src/server/agent/deepseek/web-tools-client.ts` | DeepSeek `POST /v1/tools/search|fetch` |
  | `src/server/agent/Agent/tools-registry.ts` | `createToolsForMode(mode, deps)` |
  | `src/server/agent/Agent/tools-choice.ts` | `askUserChoiceTool` |
  | `src/server/agent/Agent/tools-overwrite.ts` | `overwriteDocumentTool` |
  | `src/server/agent/Agent/almost-empty.ts` | `isAlmostEmptyDocumentText` |
  | `src/server/agent/Agent/choice-pending.ts` | `waitForUserChoice` `resolveUserChoice` |
  | `src/server/agent/Agent/tools-documents.ts` | `searchDocumentsTool` `getDocumentTool` 等单个 tool |
  | `src/server/agent/Agent/tools-sheet.ts` | 工作簿多表：`sheet_*`（`append_rows` / `update_row` / `insert_rows_at` / `overwrite` / `get_styles` 等）+ tab CRUD |
  | `src/shared/sheetDocument.ts` | `.sheet` v2：`sheets[]` + `activeSheetId`；`insertSheetRows` / `overwriteSheetTab` / `collectSheetCellStyles` |
  | `src/server/agent/Agent/tools-documents.ts` | `renameDocumentTool`（同目录改 basename） |
  | `src/server/documents/document.service.ts` | `renameDocument` |
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
  | `src/server/agent/Agent/hydrate-messages.ts` | `hydrateSessionMessagesToPi`（含落盘 tool 交换） |
  | `src/server/agent/Agent/session-tool-persist.ts` | `get_document` / `web_search` / `web_fetch` → jsonl `role:tool`；API 仍只回 user/assistant |
- **需求**：[`../requirements/user-agent-skills/`](../requirements/user-agent-skills/)（已同意）

### 搜索

- **关键词**：`FTS5` `search` `index` `title` `display_name` `bm25` `documents_fts_title` `embedding` `nomic` `semantic` `search mode` `keyword` `rebuild_semantic_index`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/search/document-index-manager.ts` | 正文+标题索引；语义尽力更新；`removeIndex`（删文清 FTS+语义，分步不互相拖垮）/ `rebuildDocument` / `backfillMissingEmbeddings` |
  | `src/server/search/search.service.ts` | `SearchMode`（auto/keyword/semantic）；两路 MATCH → 可选语义近邻 → 合并 → `canReadDocument` |
  | `src/server/routes/documents.routes.ts` | `POST /search`（mode 入参，返回 `{results, modelReady}`）；`GET /embedding-index`；`POST /embedding-rebuild` |
  | `src/server/agent/Agent/tools-documents.ts` | `searchDocumentsTool`（mode）；`listSemanticIndexTool`；`rebuildSemanticIndexTool`（可读即可索引） |
  | `src/server/search/embedding-model.ts` | 本地 GGUF 下载/load/`embedText` |
  | `src/server/search/embedding-store.ts` | chunk 写入与 cosine 近邻 |
  | `src/server/db/schema.ts` | `documents_fts*` + `document_embedding_chunks` |
  | `.mdocs-docs/requirements/search-title-index/` | 标题独立索引需求（已实现） |
  | `.mdocs-docs/requirements/search-embedding/` | 本地语义索引（已实现） |
  | `.mdocs-docs/requirements/search-query-modes/` | 检索模式入参 + 表格接查询 + 语义 Agent 工具（已实现） |

### 域 / CLI / 迁移

- **关键词**：`domain` `personal` `visitor migrate` `cli` `mdocs update`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/domains/personal-domain.service.ts` | 个人域 |
  | `src/server/cli/main.ts` | CLI 入口 |
  | `src/server/cli/self-update.ts` | `runSelfUpdate`（npmmirror 原地升级，保留 node_modules） |
  | `src/server/migrations/visitor-migration.service.ts` | 访客迁移 |
