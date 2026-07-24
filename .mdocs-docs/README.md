# .mdocs-docs — mdocs 开发契约

> 自 `fgbg-docs/` 迁入，结构遵循 **mdocs-dev** skill。  
> Agent 先查 `map/`；人审看 `requirements/` / `decisions/`；修复个案看 `bug-fixes/`。

## 文档地图

| 我想了解…… | 读这里 |
|-----------|--------|
| 关键词 → 代码坐标 | [`map/`](./map/) |
| 架构 / schema / API 等长文（人读） | [`archive/`](./archive/) |
| 技术决策 ADR | [`decisions/`](./decisions/) |
| Bug 修复记录 | [`bug-fixes/`](./bug-fixes/) |
| 已落地功能设计 | [`requirements/`](./requirements/) |
| Mermaid 图册 | [`diagrams/`](./diagrams/) |

### archive 速查

| 主题 | 文件 |
|------|------|
| 架构总览 | [`archive/architecture-overview.md`](./archive/architecture-overview.md) |
| 数据库 | [`archive/database-schema.md`](./archive/database-schema.md) |
| HTTP API | [`archive/api-reference.md`](./archive/api-reference.md) |
| 前端结构 | [`archive/frontend-structure.md`](./archive/frontend-structure.md) |
| 身份与权限 | [`archive/auth-and-access-control.md`](./archive/auth-and-access-control.md) |
| activeDocMeta / 草稿模型 | [`archive/active-doc-meta-and-draft-model.md`](./archive/active-doc-meta-and-draft-model.md) |
| commit / merge-base | [`archive/commit-naming-and-merge-base.md`](./archive/commit-naming-and-merge-base.md) |
| 搜索 | [`archive/search-implementation.md`](./archive/search-implementation.md) |
| 本地开发 | [`archive/development-environment.md`](./archive/development-environment.md) |
| 测试 | [`archive/testing-strategy.md`](./archive/testing-strategy.md) |
| clean-room | [`archive/clean-room-policy.md`](./archive/clean-room-policy.md) |

### requirements 状态

均为历史已落地功能；契约视为 **已同意（历史迁入）**。正文即原 `fgbg-docs` 长文，未拆成完整三件套。

| 需求夹 | 说明 |
|--------|------|
| `bookmarks` | 文档收藏 |
| `auto-save-draft` | 自动保存草稿 |
| `recovery-code` | 恢复码 |
| `draft-copy-preview` | 草稿副本与预览 |
| `draft-publish-recovery` | 发布失败恢复 |
| `comments-panel` | 评论区布局 / 拖拽（两篇契约） |
| `doc-info-menu` | 文档信息菜单与图标 |
| `editor-content-width` | 编辑区宽度溢出 |

## 目录约定

```
.mdocs-docs/
├── README.md
├── map/           # 机器坐标（增厚中）
├── archive/       # 人读长文（从 fgbg-docs 直接搬入）
├── decisions/     # ADR
├── bug-fixes/     # 事后修复
├── diagrams/      # Mermaid（diagram skill）
└── requirements/  # 功能契约
```
