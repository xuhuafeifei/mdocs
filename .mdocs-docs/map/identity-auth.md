# map — identity & auth

人读长文：[`../archive/auth-and-access-control.md`](../archive/auth-and-access-control.md)  
决策：[`../decisions/001-visitor-identity.md`](../decisions/001-visitor-identity.md)、[`008-visitor-name-unique-and-migrate-by-name.md`](../decisions/008-visitor-name-unique-and-migrate-by-name.md)、[`011-permission-visibility-no-folder-invite.md`](../decisions/011-permission-visibility-no-folder-invite.md)

### 访客注册 / Token

- **关键词**：`visitor` `x-visitor-token` `SHA-256` `register`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/identity/auth.middleware.ts` | 鉴权中间件 |
  | `src/server/identity/visitor.service.ts` | 注册 / 解析 |
  | `src/shared/types/visitor.ts` | 类型 |

### 访问控制（档位判定）

- **关键词**：`PRIVATE` `DOMAIN_READ` `DOMAIN_WRITE` `PUBLIC_READ` `PUBLIC_WRITE` `canReadDocument` `canEditDocument`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/access/access-control.ts` | `canReadDocument` / `canEditDocument` / `assertDocumentAccess` |
  | `src/server/middleware/document-auth.middleware.ts` | `requireDocumentAccess` |
  | `src/server/documents/document.service.ts` | 权限等级常量 |

### 可见性粒度（无目录邀请）

- **关键词**：`domain_members` `document_invites` `folder invite` `子树可见` `目录邀请` `viaDocumentInvites` `full`
- **结论**：圈人只有 **域成员（整域）** 与 **单篇 document invite**；**没有**「邀请进目录 → 子树全部可读」。见 ADR-011。
- **图谱**：private/restricted 仅 `full` 可读可生成；`viaDocumentInvites` 屏蔽。见 [`设计契约-graph-access.md`](../requirements/knowledge-graph/设计契约-graph-access.md)。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/access/access-control.ts` | invite 叠加读/写 |
  | `src/server/access/domain-access.ts` | `resolveDomainAccess` / `full` / `viaDocumentInvites` |
  | `src/server/db/repositories/` | `document_invites` / `domain_members` 表访问 |
  | `src/server/routes/documents.routes.ts` | `…/invites` |
  | `src/server/routes/domains.routes.ts` | `…/members` |
  | `src/server/routes/graph.routes.ts` | 图谱 GET/analyze（落地门禁） |

### CLI Token

- **关键词**：`x-cli-token` `cli_tokens` `MDOCS_TOKEN`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/identity/auth.middleware.ts` | 先 visitor 再 cli |
  | `src/server/identity/cli-token.service.ts` | 解析 / 吊销 |
  | `src/server/routes/cli-tokens.routes.ts` | 设置页 CRUD |

### 登录态失效（修复记录）

- **关键词**：`cookie` `localStorage` `login invalidation`
- **记录**：[`../bug-fixes/login-state-invalidation-2026-05-09.md`](../bug-fixes/login-state-invalidation-2026-05-09.md)
