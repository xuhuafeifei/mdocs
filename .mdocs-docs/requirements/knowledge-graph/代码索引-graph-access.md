# 知识图谱访问门禁 — 代码索引

> 契约：[`设计契约-graph-access.md`](./设计契约-graph-access.md)（已同意；落地时改下列入口）

| 关键词 | 路径 | 符号 |
|--------|------|------|
| 域入口 kind | `src/server/access/domain-access.ts` | `resolveDomainAccess` / `DomainAccessKind` (`full` \| `viaDocumentInvites` \| `none`) |
| 图谱路由 | `src/server/routes/graph.routes.ts` | GET/POST `/:folderId`、`/domain/:domainId`、analyze |
| 域/目录构建 | `src/server/documents/graph.service.ts` | `buildDomainGraph` / `buildGraphByDocId` / `getGraphByFolderId` |
| 任务入队 | `src/server/documents/graph-task.ts` | `runDomainGraph` / `runDocGraph`（payload.`visitorId`） |
| 前端图谱页 | `src/web/app/GraphPage.tsx` | 拉取 / 生成按钮 |
| 树拼装（可见子集） | `src/server/documents/tree.service.ts` | `buildDocumentTree` / `buildFolderSubtree` |
