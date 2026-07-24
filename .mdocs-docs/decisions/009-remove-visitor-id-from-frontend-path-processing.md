# ADR-009: 个人域路径处理移到后端，前端去 visitorId

## 状态

已实施 2026-05-09

## 背景

1. 前端需要从 localStorage 读取 visitorId 来判断是否要去掉个人域路径前缀（`_personal/{visitorId}/`）
2. 这造成前端对 visitorId 的感知，增加了复杂度
3. 后端通过 token 已经知道当前访客是谁，完全可以在服务端处理路径

## 决策

### 1. 后端 Tree API 直接处理路径

- `tree.service.ts` - `buildTreeFromRows()` 接收 `visitorId` 参数
- 构建树节点时，如果是**访客自己的个人域文档**，自动去掉 `_personal/{visitorId}/` 前缀
- 非个人域或他人分享的文档路径保持不变

### 2. 前端删除所有 visitorId 依赖的路径处理

- `App.tsx` - 删除 `docPathForSelection` 函数
- `useCreateModal.ts` - 删除 `docPathForSelection` 函数
- 直接使用后端返回的 `relativePath` / `path` 字段

### 3. localStorage 仍保留 visitorId

- 只用于 `initDomainsAndTree` 时判断个人域（pickInitialDomainId）
- 不用于任何路径处理逻辑

## 涉及文件

- `src/server/documents/tree.service.ts` - 路径前缀处理
- `src/web/app/App.tsx` - 删除 `docPathForSelection`
- `src/web/app/hooks/useCreateModal.ts` - 删除 `docPathForSelection`

## 后果

- 前端不再需要知道 visitorId 来做路径判断
- 所有权限相关的路径处理统一在服务端完成
- 代码更简洁，前端状态更少
- 路径显示逻辑更安全（不会因为前端状态错误显示不该看到的路径）
