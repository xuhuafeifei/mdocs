# 测试策略

> 本文回答：mdocs 如何测试、测试分层、运行方式、关键测试用例覆盖哪些逻辑。

## 测试框架

- **Runner**：Vitest 2.1.9
- **DOM 环境**：`jsdom`（用于前端组件测试）
- **配置**：`vitest.config.ts`

## 分层

| 层级 | 文件模式 | 说明 |
|------|----------|------|
| 单元测试 | `*.test.ts` | 单个函数/类，无 DB、无网络 |
| 集成测试 | `*.integration.test.ts` | 涉及真实 SQLite 数据库或 Service 组合 |

## 运行方式

```bash
pnpm test          # 一次性运行全部
pnpm test:watch    # 交互式监听模式
```

## 关键测试覆盖

### 访问控制（核心）

- **文件**：`src/server/access/access-control.test.ts`
- **覆盖**：
  - 五级权限在各种域类型下的读/写组合。
  - owner 特权。
  - 未登录访客的行为。
  - invite 叠加逻辑。
  - `assertDocumentAccess` 的 403/404 抛出。

### 文档服务

- **单元测试**：`src/server/documents/document.service.test.ts`
- **集成测试**：`src/server/documents/document.service.integration.test.ts`
- **覆盖**：
  - 创建/读取/更新/删除文档。
  - 内容哈希冲突（乐观锁）。
  - 树结构构建（`parent_id`）。
  - 域约束（文档档位是否被域类型允许）。

## 测试数据

- 集成测试通常使用内存 SQLite 或临时文件数据库。
- 每个测试用例独立事务，测试结束后清理。

## 待补充

- [ ] 前端组件测试（React Testing Library）
- [ ] API 端到端测试（如使用 `supertest`）
- [ ] 性能基准测试（大文档树渲染）

## 编写测试的建议

1. **优先测边界**：权限系统的边界条件（如 `private` 域的 `domain_write` 实际不可写）。
2. **独立事务**：集成测试每个用例后回滚或删除数据。
3. **命名清晰**：`it('should reject non-owner delete')` 比 `it('delete test')` 更有用。
