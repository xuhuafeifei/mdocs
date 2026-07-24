# map — identity & auth

人读长文：[`../archive/auth-and-access-control.md`](../archive/auth-and-access-control.md)  
决策：[`../decisions/001-visitor-identity.md`](../decisions/001-visitor-identity.md)、[`008-visitor-name-unique-and-migrate-by-name.md`](../decisions/008-visitor-name-unique-and-migrate-by-name.md)

### 访客注册 / Token

- **关键词**：`visitor` `x-visitor-token` `SHA-256` `register`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/identity/auth.middleware.ts` | 鉴权中间件 |
  | `src/server/identity/visitor.service.ts` | 注册 / 解析 |
  | `src/shared/types/visitor.ts` | 类型 |

### 访问控制

- **关键词**：`PRIVATE` `PUBLIC_READ` `PUBLIC_EDIT` `INVITE` `access`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/access/access-control.ts` | 权限判定 |
  | `src/server/documents/document.service.ts` | 权限等级常量 |

### 登录态失效（修复记录）

- **关键词**：`cookie` `localStorage` `login invalidation`
- **记录**：[`../bug-fixes/login-state-invalidation-2026-05-09.md`](../bug-fixes/login-state-invalidation-2026-05-09.md)
