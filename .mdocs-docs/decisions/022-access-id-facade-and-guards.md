# 022 — access 对外只收 id；Guard 薄适配；规则只活在 access

- **状态**：accepted（2026-11-13）。门面 `modules/access/access.ts` + `nest/guards/nest-can-*.guard.ts` 已落地；旧行级 API 仍保留供迁移。
- **上下文**：业务层不想拼 `DocumentRow` / `DomainAccessInfo`。期望 `canRead(visitorId, domainId, documentId)` 即可判定。HTTP 要用 Nest Guard 横切，Agent/tree 的 application 也要能直接调同一套 API。`access` 在 `modules/` 下，允许持有授权业务与内部查库。
- **决策**：

## 1. 目录（access 暂扁平）

```text
modules/access/
  access.ts              # 对外门面：只收 id（新）
  access-control.ts      # 现有行级判定（内部，逐步只被 access.ts 调用）
  domain-access.ts       # 现有域入口解析（内部）
  # 暂不拆 controller/application/service

nest/guards/             # 框架适配，不是业务
  nest-can-enter-domain.guard.ts
  nest-can-read-document.guard.ts
  nest-can-write-document.guard.ts
```

规则本体 **只**在 `modules/access`。`nest/guards` 只抠路由参数并转发。

## 2. 对外 API（业务只看见这个）

```ts
// modules/access/access.ts

/** 能否进入该域（看树 / 列域文档的前门）。 */
export function canEnterDomain(
  visitorId: string | null,
  domainId: string,
): boolean;

/** 能否读该文档。文档不属于 domainId 时返回 false（或抛 DOC_NOT_FOUND，见下）。 */
export function canRead(
  visitorId: string | null,
  domainId: string,
  documentId: string,
): boolean;

/** 能否写该文档（现码 canEdit 语义）。 */
export function canWrite(
  visitorId: string | null,
  domainId: string,
  documentId: string,
): boolean;

/** HTTP / 需要硬失败时用：不行就抛带 code/status 的 Error（现 DocumentError）。 */
export function assertCanEnterDomain(visitorId: string | null, domainId: string): void;
export function assertCanRead(visitorId: string | null, domainId: string, documentId: string): void;
export function assertCanWrite(visitorId: string | null, domainId: string, documentId: string): void;
```

门面内部自己：`getDb` → 查 domain / document → 校验 `doc.domain_id === domainId` → 调现有 `resolveDomainAccess` / `canReadDocument` / `canEditDocument`。  
调用方 **禁止**再传 Row / DomainAccessInfo。

可选批量（tree 用，避免 N 次重复拼域上下文）：

```ts
/** 同一 domain 下过滤可读 documentId；实现里只 resolve 一次域上下文。 */
export function filterReadableDocumentIds(
  visitorId: string | null,
  domainId: string,
  documentIds: string[],
): string[];
```

一期可以没有批量，tree 先循环 `canRead`；热了再加。

## 3. 门面怎么写（示意）

```ts
export function canRead(
  visitorId: string | null,
  domainId: string,
  documentId: string,
): boolean {
  const db = getDb();
  const domain = findDomainById(db, domainId);
  const access = resolveDomainAccess(db, domain, domainId, visitorId);
  if (!canEnterDomainTree(access)) return false;

  const row = findDocumentById(db, documentId);
  if (!row || row.domain_id !== domainId) return false;

  const domainInfo = makeDomainAccessInfo(
    db,
    domainId,
    visitorId,
    domain?.permission ?? "public",
  );
  return canReadDocument(row, visitorId, domainInfo);
}
```

`canEnterDomain` / `canWrite` 同构。`assert*` = `if (!can*) throw new DocumentError(...)`。

## 4. Guard 怎么写（必须薄）

```ts
// nest/guards/nest-can-read-document.guard.ts
@Injectable()
export class NestCanReadDocumentGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const visitorId = req.visitor?.visitor_id ?? null;
    const domainId = String(req.params.domainId ?? req.query.domainId ?? "");
    const documentId = String(req.params.documentId ?? "");
    assertCanRead(visitorId, domainId, documentId); // 抛错 → ExceptionFilter
    return true;
  }
}
```

Controller：

```ts
@Get(":documentId")
@UseGuards(NestCanReadDocumentGuard)
get(@Param("documentId") documentId: string) {
  return getDocument(documentId); // application 不再重复鉴权（或再 assert 一次作防御，二选一，建议 Guard 负责 HTTP）
}
```

**禁止**在 Guard 里写 SQL、拼 permission 档位、解析 invite。那些只在 access。

## 5. tree.application 怎么用

```ts
export function getDocumentTree(domainId: string | undefined, visitorId: string | null): TreeNode[] {
  const effective = domainId?.trim() || getConfig().defaultDomainId;
  if (!canEnterDomain(visitorId, effective)) return [];

  const rows = listDocumentsByDomain(effective); // documents 薄能力，未鉴权列表
  const visible = rows.filter((r) => canRead(visitorId, effective, r.document_id));
  return buildTreeFromRows(visible, visitorId);
}
```

HTTP：`GET /api/tree` 可加 `NestCanEnterDomainGuard`（query.domainId）；节点过滤仍在 application 调 `canRead`。

## 6. 复杂度落点

| 层 | 有什么 | 没有什么 |
|----|--------|----------|
| `nest/guards` | 抠 id、调 assert* | SQL、档位规则 |
| `modules/access` | 授权规则 + 内部查库 | 建树、改文档内容 |
| `modules/tree/application` | 组合列文 + canRead + 建树 | 自己发明权限 |
| `documents` service | 按域列行、按 id 取行 | canRead 规则 |

复杂度撑在 access（本来就是 modules 里的授权域）——说得通。Guard 不膨胀。

## 7. 与 021 关系

补充 021：三权对外形态定为 **id 门面**；Nest AOP 用 **Guard**；access 暂扁平。本 ADR 落地后把 021 里「调用方传入行」的表述改成「门面收 id，内部查」。

- **后果**：
  - 迁移期可保留 `canReadDocument(row, …)` 为 internal，避免一次改全仓；新代码只走门面。
  - `domainId` 与 `documentId` 不一致时统一 `false` / 404，避免越域读。
  - Guard 与 application 双入口，规则仍一份。
- **不在本期**：把现有 Express `document-auth.middleware` 删光；跟 Nest 迁路由一起替换。

## 8. 重构 TODO（已同意，后做）

现状痛点（先 `@deprecated`，不一次拆完）：

1. **access 直打 repo**（`findDomainById` / `findDocumentById` / invite 查询）——应收口到 `domains` / `documents` 的**薄 service**，access 只组合「能不能」。
2. **`resolveDomainAccess(db, domainRow, domainId, visitorId, options?)` 签名过脏**——调用方还要懂 `DomainRow`、自己预取邀请。目标干掉，只留 id 门面。
3. **`ResolveDomainAccessOptions.documentInviteDomainIds` 把邀请优化暴露给调用方**——错误。应改为内部批量：`canEnterDomains(visitorId, domainIds: string[])`（access 内一次查邀请/成员），不要 Options。
4. **行级 `canReadDocument(row, visitorId, domainInfo)` / `canEditDocument`**——业务禁止再调；仅 access 门面内部或删前过渡。
5. **前置依赖**：documents / domains 先抽出「按 id 查 / 按域列 / 成员与邀请查询」薄 service 后，再改 access 内部；当前动不了就继续走 repo，但新代码只进 `access.ts` 门面。

代码标记：`resolveDomainAccess`、`ResolveDomainAccessOptions`、`canEnterDomainTree`、`canReadDocument`、`canEditDocument` 已加 `@deprecated` → 指向本 TODO。
