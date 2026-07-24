# ADR 索引

> ADR（Architecture Decision Record）：记录项目中的重大技术决策，包括决策背景、选项对比、最终选择、后果与风险。

## 格式约定

每篇 ADR 文件名：`NNN-<短标题>.md`

内容结构：
1. **状态**：`proposed` / `accepted` / `deprecated` / `superseded by ADR-NNN`
2. **上下文**：当时面临的问题和约束
3. **决策**：做了什么选择
4. **后果**：正面影响、负面影响、风险

## 已有记录

| 编号 | 标题 | 状态 | 一句话摘要 |
|------|------|------|-----------|
| 001 | [访客身份替代账号系统](./001-visitor-identity.md) | accepted | 用高熵 Token + 本地存储替代传统账号密码，降低使用门槛 |
| 002 | [显式目录模型 + parentId 全链路](./002-explicit-folder-model.md) | accepted | TreeFolderNode 暴露 documentId，前端创建文档时传 parentId，文件夹始终创建 ___desc___.md |
| 003 | [后端自动计算文档路径](./003-api-path-calculation.md) | accepted | createDocument 改为接收 fileName + parentId，relativePath 由后端自动计算 |
| 008 | [访客名唯一 + 按名迁移](./008-visitor-name-unique-and-migrate-by-name.md) | accepted | 昵称唯一约束；迁移支持按名称 |
| 009 | [前端路径处理去掉 visitorId](./009-remove-visitor-id-from-frontend-path-processing.md) | accepted | 个人域路径前缀仅后端处理 |
