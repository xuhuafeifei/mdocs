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
| `agent-chat-mermaid` | **已同意**：Ask 聊天气泡 mermaid 默认渲染、可切代码；只存源码前端翻译 — [需求分析](./requirements/agent-chat-mermaid/需求分析.md) · [设计契约](./requirements/agent-chat-mermaid/设计契约.md) |
| `html-documents` | **草案**：HTML 文档、草稿/merge 分流、file_type 政策表 — [需求分析](./requirements/html-documents/需求分析.md) · [设计契约](./requirements/html-documents/设计契约.md) |
| `user-agent-skills` | **已同意**：私人 skill；展开=合成 tool 往返+去重新优先；本轮结束清空标签 — [需求分析](./requirements/user-agent-skills/需求分析.md) · [设计契约](./requirements/user-agent-skills/设计契约.md) · [代码索引](./requirements/user-agent-skills/代码索引.md) |
| `agent-run-refactor` | Phase 1–3 已落地：SSE / tools template·registry / pi-run — [需求分析](./requirements/agent-run-refactor/需求分析.md) · [设计契约](./requirements/agent-run-refactor/设计契约.md) · [代码索引](./requirements/agent-run-refactor/代码索引.md) |
| `agent-normal-coding-modes` | **已同意**：含增量「inline diff 可编辑提案」— [需求分析](./requirements/agent-normal-coding-modes/需求分析.md) · [设计契约](./requirements/agent-normal-coding-modes/设计契约.md) |
| `onboarding-ai` | **已同意**：上手 Agent — [需求分析](./requirements/onboarding-ai/需求分析.md) · [设计契约](./requirements/onboarding-ai/设计契约.md) · [后端设计](./requirements/onboarding-ai/后端设计.md) |
| `document-move` | **已同意**：同域拖拽移动文档 — [需求分析](./requirements/document-move/需求分析.md) · [设计契约](./requirements/document-move/设计契约.md) · [代码索引](./requirements/document-move/代码索引.md) |
| `merge-inline-ui` | **已同意**：冲突 Merge 单栏 inline（接收/拒绝 · 全部用我的/别人的）— [需求分析](./requirements/merge-inline-ui/需求分析.md) · [设计契约](./requirements/merge-inline-ui/设计契约.md) |
| `agent-mobile-context` | **已同意**：手机助手全屏；Ask 注入当前域/文 id；**增量** PC 全屏切换 — [需求分析](./requirements/agent-mobile-context/需求分析.md) · [设计契约](./requirements/agent-mobile-context/设计契约.md) · [PC 全屏](./requirements/agent-mobile-context/设计契约-pc-fullscreen.md) |
| `knowledge-graph` | 知识图谱（历史已同意）— [需求分析](./requirements/knowledge-graph/需求分析.md) · [设计契约](./requirements/knowledge-graph/设计契约.md)；分层展开 [layered-view](./requirements/knowledge-graph/设计契约-layered-view.md)；**增量草案** 单一焦点 — [single-focus](./requirements/knowledge-graph/设计契约-single-focus.md) |
| `graph-cache-dirty` | **已同意**：图谱缓存 dirty / 发布变化率 / 异步 lifecycle（无 bus）— [需求分析](./requirements/graph-cache-dirty/需求分析.md) · [设计契约](./requirements/graph-cache-dirty/设计契约.md) · [代码索引](./requirements/graph-cache-dirty/代码索引.md) |
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
