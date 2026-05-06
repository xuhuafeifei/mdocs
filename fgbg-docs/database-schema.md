# 数据库 Schema

> 本文回答：mdocs 用了哪些表、字段含义、索引、以及 Schema 如何随版本演进。

## 总览

- **引擎**：SQLite（`better-sqlite3`）
- **连接位置**：`src/server/db/connection.ts`
- **Schema 定义**：`src/server/db/schema.ts`
- **Repository 层**：`src/server/db/repositories/*.ts`

## 表清单

### 1. `visitors` — 访客身份

| 字段 | 类型 | 说明 |
|------|------|------|
| `visitor_id` | TEXT PK | UUID，公开标识 |
| `visitor_name` | TEXT | 用户输入的昵称 |
| `visitor_token_hash` | TEXT UNIQUE | `SHA-256(原始token)`，服务端只存哈希 |
| `created_at` | TEXT | ISO 时间 |
| `last_seen_at` | TEXT | 最后活跃时间 |
| `disabled_at` | TEXT | 禁用时间（访客合并后被禁用） |
| `merged_into_visitor_id` | TEXT | 指向新访客（迁移后填充） |

**索引**：`idx_visitors_token_hash` — 鉴权时按哈希查身份。

### 2. `domains` — 域（知识库空间）

| 字段 | 类型 | 说明 |
|------|------|------|
| `domain_id` | TEXT PK | 如 `"default"` 或 UUID |
| `domain_name` | TEXT | 显示名称 |
| `creator_visitor_id` | TEXT | 创建者（原 `created_by` 已迁移） |
| `created_at` | TEXT | ISO 时间 |
| `updated_at` | TEXT | 最后更新时间 |
| `permission` | TEXT DEFAULT 'public' | `public` / `restricted` / `private` |

**特殊行**：`domain_id = 'default'` 在 `applySchema` 时自动插入，确保系统始终有一个默认域。

### 3. `documents` — 文档元数据

| 字段 | 类型 | 说明 |
|------|------|------|
| `document_id` | TEXT PK | UUID |
| `domain_id` | TEXT FK → `domains` | 所属域 |
| `relative_path` | TEXT UNIQUE | 磁盘存储路径（唯一） |
| `display_name` | TEXT | 展示标题 |
| `owner_visitor_id` | TEXT FK → `visitors` | 创建者/拥有者 |
| `created_by` | TEXT | 创建者 visitor_id（冗余） |
| `updated_by` | TEXT | 最后更新者 visitor_id |
| `content_hash` | TEXT | 内容哈希（用于冲突检测） |
| `created_at` | TEXT | ISO 时间 |
| `updated_at` | TEXT | ISO 时间 |
| `permission` | INTEGER DEFAULT 1 | 0~4，见 `auth-and-access-control.md` |
| `is_dirty` | INTEGER DEFAULT 1 | 索引脏标记（1=待重建，0=已同步），用于 FTS5 增量索引 |

**索引**：
- `idx_documents_domain` — 按域查文档
- `idx_documents_owner` — 按拥有者查文档

> 注意：`documents` 表存元数据，真正的 Markdown 内容存在 `~/.mdocs/files/docs/` 下，以 `relative_path` 定位。

### 4. `attachments` — 附件

| 字段 | 类型 | 说明 |
|------|------|------|
| `attachment_id` | TEXT PK | UUID |
| `document_id` | TEXT FK → `documents` | 所属文档（可空） |
| `relative_path` | TEXT | 磁盘路径 |
| `mime_type` | TEXT | MIME 类型 |
| `byte_size` | INTEGER | 字节大小 |
| `owner_visitor_id` | TEXT | 上传者 |
| `created_at` | TEXT | ISO 时间 |

### 5. `audit_logs` — 审计日志

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 自增 ID |
| `actor_visitor_id` | TEXT | 操作者 |
| `action` | TEXT | 动作标识 |
| `target_type` | TEXT | 对象类型 |
| `target_id` | TEXT | 对象 ID |
| `metadata_json` | TEXT | JSON 附加信息 |
| `created_at` | TEXT | ISO 时间 |

**索引**：`idx_audit_actor`, `idx_audit_target`

### 6. `visitor_migrations` — 访客合并记录

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 自增 ID |
| `from_visitor_id` | TEXT | 旧访客 |
| `to_visitor_id` | TEXT | 新访客 |
| `affected_counts_json` | TEXT | 各表影响行数 JSON |
| `executed_at` | TEXT | 执行时间 |

### 7. `document_invites` — 文档级邀请

| 字段 | 类型 | 说明 |
|------|------|------|
| `document_id` | TEXT PK | 文档 ID |
| `visitor_id` | TEXT PK | 被邀请访客 ID |
| `permission` | TEXT DEFAULT 'read' | `read` / `edit` |

**索引**：`idx_document_invites_doc`

> 与域成员互斥：已是域成员的人不能被 invite。

### 8. `domain_members` — 域成员

| 字段 | 类型 | 说明 |
|------|------|------|
| `domain_id` | TEXT PK | 域 ID |
| `visitor_id` | TEXT PK | 成员 visitor_id |
| `joined_at` | TEXT | 加入时间 |

**索引**：`idx_domain_members_domain`, `idx_domain_members_visitor`

> `private` 域不引入多成员：唯一成员即域主（`domain_id === owner_visitor_id` 的那位）。

### 9. `domain_member_templates` — 域成员模板

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK AUTOINCREMENT | 自增 ID |
| `display_name` | TEXT | 模板名称 |
| `domain_visitor_ids` | TEXT | 逗号分隔的 visitor_id 列表 |
| `create_visitor_id` | TEXT | 创建者 |
| `create_time` | TEXT | ISO 时间 |
| `update_time` | TEXT | ISO 时间 |

**索引**：`idx_domain_member_templates_owner`

### 10. `documents_fts` — 全文检索索引 (FTS5)

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | TEXT (indexed) | 文档正文，FTS5 全文索引列 |
| `document_id` | TEXT (UNINDEXED) | 关联的文档 ID |
| `display_name` | TEXT (UNINDEXED) | 文档展示名 |
| `relative_path` | TEXT (UNINDEXED) | 文档相对路径 |
| `domain_id` | TEXT (UNINDEXED) | 所属域 ID |
| `owner_visitor_id` | TEXT (UNINDEXED) | 文档创建者 |
| `permission` | INTEGER (UNINDEXED) | 权限档位 (0-4) |

**配置**：`tokenize='unicode61'`，BM25 排名。

### 11. `documents_fts_rowid` — FTS rowid 映射

| 字段 | 类型 | 说明 |
|------|------|------|
| `document_id` | TEXT PK | 文档 ID |
| `fts_rowid` | INTEGER | FTS5 虚拟表中对应的 rowid |

> 用途：FTS5 删除/更新条目需要通过 rowid 定位，此表维护 document_id → rowid 映射。

### 12. `cli_tokens` — CLI 身份令牌

| 字段 | 类型 | 说明 |
|------|------|------|
| `token_id` | TEXT PK | UUID |
| `visitor_id` | TEXT NOT NULL | 绑定的访客 ID |
| `token_hash` | TEXT UNIQUE NOT NULL | `SHA-256(原始token)`，服务端只存哈希 |
| `name` | TEXT NOT NULL | 别名（默认 `"cli-token"`） |
| `revoked` | INTEGER DEFAULT 0 | 是否已吊销（0=活跃，1=已吊销） |
| `created_at` | TEXT NOT NULL | ISO 时间 |

**索引**：`idx_cli_tokens_visitor` — 按访客查所有 token。

**逻辑**：重置时在事务中先 `revokeAllCliTokensByVisitor`，再插入新记录。同一访客同一时刻只有一个活跃 token。

## Schema 演进

- **无迁移框架**：使用 `applySchema`（`src/server/db/schema.ts`）在启动时执行 `CREATE TABLE IF NOT EXISTS` 和 `CREATE INDEX IF NOT EXISTS`。
- **兼容旧表**：`migrateDomainsTable` 处理列重命名（`created_by` → `creator_visitor_id`）和新增列（`updated_at`）。
- **破坏性变更**：需要手写迁移脚本（参考 `src/server/migrations/visitor-migration.service.ts`）。
