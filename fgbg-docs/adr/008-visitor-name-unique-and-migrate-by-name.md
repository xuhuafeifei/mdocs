# ADR-008: 访客名称全局唯一 + migrate 支持按名称识别

## 状态

已实施 2026-05-09

## 背景

1. migrate 脚本必须输入 UUID，难记、容易输错
2. visitor_name 没有唯一性约束，理论上可以有多个同名访客

## 决策

### 1. 数据库层面

- `visitors.visitor_name` 列添加 `UNIQUE` 约束（schema.ts）
- 名称是全局唯一的，包含已禁用的访客（数据库层面约束）

### 2. 注册时检查重名

- `visitor.service.ts` - registerVisitor 时先检查名称是否已被占用
- 只允许注册**未被启用访客**使用过的名称
- 已禁用的访客名称也不可复用（数据库 UNIQUE 约束保证）

### 3. migrate 脚本支持按名称识别

- `visitor.repo.ts` - 新增 `findVisitorByName()` 函数
- `cli/main.ts` - `resolveVisitor()` 智能解析：先按 UUID 查，找不到再按名称查
- CLI 用法：`pnpm mdocs visitor migrate --from Alice --to Bob --confirm`

### 4. 边界处理

- 按名称查找时只返回**未禁用**的访客（避免查到已合并的历史记录）
- 查到已禁用访客时返回明确错误：`VISITOR_DISABLED`

## 涉及文件

- `src/server/db/schema.ts` - UNIQUE 约束
- `src/server/db/repositories/visitor.repo.ts` - `findVisitorByName`
- `src/server/identity/visitor.service.ts` - 重名检查
- `src/server/cli/main.ts` - `resolveVisitor` 智能解析

## 后果

- 迁移时不再需要复制粘贴 UUID，直接用名称即可
- 访客名称全局唯一，不会出现混淆
- 数据库层面保证一致性，不会有重名数据进入系统
