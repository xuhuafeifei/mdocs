# 恢复码（Recovery Code）

> 恢复码让用户不依赖后端 Token 即可找回身份，替代管理员手动执行 `visitor migrate` 的运维操作。

## 设计

### 数据流

```
注册 → 后端生成 → 存 SHA-256(recovery_code_hash) → 返回原始码 → 用户保存
找回 → 用户输入原始码 → 后端 hash → 查库匹配 → 发新 Token → 清空 code_hash
设置页 → 已登录用户生成新码 → 覆盖旧 hash
```

### 格式

`XXXX-XXXX-XXXX-XXXX` — 4 组 4 位大写字母+数字（去掉 0/O/1/I 等易混淆字符），熵值约 80 bit。

### 安全约束

| 属性 | 策略 |
|------|------|
| 存储 | 只存 SHA-256，不存原文 |
| 展示 | 注册时弹窗展示一次，设置页生成时展示一次 |
| 有效期 | 无限期，直到被使用或覆盖 |
| 使用次数 | **一次性** — 找回成功后立即清空 hash |
| 覆盖 | 生成新码时自动覆盖旧码，旧码立即失效 |

## 表结构

`visitors` 表新增列：

```sql
recovery_code_hash TEXT
```

非 NULL 表示该访客有有效的恢复码。

## 后端 API

### `POST /api/visitors/register`（修改）

返回值增加 `recoveryCode` 字段：

```json
{
  "data": {
    "visitor": { ... },
    "visitorToken": "...",
    "recoveryCode": "ABCD-EFGH-IJKL-MNOP"
  }
}
```

### `POST /api/visitors/recover`（新增）

**无需认证**。请求体：

```json
{ "recoveryCode": "ABCD-EFGH-IJKL-MNOP" }
```

成功返回 200：

```json
{
  "data": {
    "visitor": { ... },
    "visitorToken": "new-token"
  }
}
```

失败（码无效或已使用）返回 404：

```json
{ "error": { "code": "INVALID_RECOVERY_CODE", "message": "..." } }
```

### `POST /api/visitors/recovery-code`（新增）

**需要认证**。为当前登录访客生成新恢复码（覆盖旧的）。

```json
{ "data": { "recoveryCode": "WXYZ-ABCD-EFGH-IJKL" } }
```

## 涉及的文件

| 文件 | 改动 |
|------|------|
| `src/server/db/schema.ts` | `migrateVisitorsRecoveryCode()` + 列名检测 |
| `src/server/db/repositories/visitor.repo.ts` | `findVisitorByRecoveryCodeHash()` / `updateRecoveryCodeHash()` |
| `src/server/identity/token.ts` | `newRecoveryCode()` / `hashRecoveryCode()` |
| `src/server/identity/visitor.service.ts` | `registerVisitor` 返回码 / `recoverVisitor()` / `generateRecoveryCode()` |
| `src/server/routes/visitors.routes.ts` | `POST /recover` / `POST /recovery-code` |
| `src/server/identity/auth.middleware.ts` | `/visitors/recover` 加入免认证 |
| `src/shared/types/visitor.ts` | `VisitorRegisterResponse.recoveryCode` / `VisitorRecoverResponse` |
| `src/web/services/endpoints.ts` | `recoverVisitorApi()` / `generateRecoveryCodeApi()` |
| `src/web/services/client.ts` | demoApi 路由映射 |
| `src/web/services/mockApi.ts` | `mockRecoverVisitor()` / 注册 mock 加 recoveryCode |
| `src/web/app/App.tsx` | 注册后弹窗展示恢复码 / 退出确认 |
| `src/web/app/VisitorRegisterDialog.tsx` | "用恢复码找回"模式 |
| `src/web/app/SettingsPage.tsx` | 通用 Tab 恢复码管理卡片 |
| `src/server/identity/visitor.service.test.ts` | 7 个单元测试 |
