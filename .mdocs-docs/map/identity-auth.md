# map — identity & auth

人读长文：[`../archive/auth-and-access-control.md`](../archive/auth-and-access-control.md)  
决策：[`../decisions/001-visitor-identity.md`](../decisions/001-visitor-identity.md)、[`008-visitor-name-unique-and-migrate-by-name.md`](../decisions/008-visitor-name-unique-and-migrate-by-name.md)、[`011-permission-visibility-no-folder-invite.md`](../decisions/011-permission-visibility-no-folder-invite.md)

### 用语：工作空间 / domain

- **关键词**：`工作空间` `Workspace` `domain_id` `个人域` `localizeDomainName`
- **结论**：对人说 **工作空间**。表、字段、API、错误码、`--domain` 仍叫 domain。库存个人空间名后缀仍是「个人域」，展示换成「个人工作空间」。旧契约里的「域」不回溯改写。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `.mdocs-docs/requirements/workspace-wording-start-writing/设计契约.md` | 概念分层 |
  | `src/web/app/utils.ts` | `localizeDomainName` |
  | `src/shared/personalDomain.ts` | `PERSONAL_DOMAIN_NAME_SUFFIX` |

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

### 域成员读写角色

- **关键词**：`domain_members.role` `read` `write` `domainMemberCanWrite` `domainMemberWrite`
- **结论**：成员默认 `read`（可看）；`write` + 文档 `domain_write` 才能编。与 invite 互斥、无关。见 [`domain-member-role`](../requirements/domain-member-role/设计契约.md)。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/db/repositories/domain.repo.ts` | `getDomainMemberRole` `replaceDomainMembers` |
  | `src/server/access/access-control.ts` | `DomainAccessInfo.domainMemberCanWrite` |
  | `src/web/app/EditorPaneHost.tsx` | `canEdit` |

### CLI Token

- **关键词**：`x-cli-token` `cli_tokens` `MDOCS_TOKEN` `多 Token` `启停` `硬删`
- **结论**：可同时多个活跃；`revoked` 软停用可再开；`DELETE` 硬删行不可恢复；签发不再 revokeAll。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/identity/auth.middleware.ts` | 先 visitor 再 cli |
  | `src/server/identity/cli-token.service.ts` | `createCliToken` `setCliTokenRevoked` `deleteCliToken` |
  | `src/server/routes/cli-tokens.routes.ts` | GET/POST/PATCH/DELETE |
- **需求**：[`../requirements/cli-multi-token/`](../requirements/cli-multi-token/)

### 登录态失效（修复记录）

- **关键词**：`cookie` `localStorage` `login invalidation`
- **记录**：[`../bug-fixes/login-state-invalidation-2026-05-09.md`](../bug-fixes/login-state-invalidation-2026-05-09.md)
