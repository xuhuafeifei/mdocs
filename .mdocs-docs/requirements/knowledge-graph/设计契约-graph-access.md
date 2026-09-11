# 知识图谱访问门禁 — 设计契约

> **状态**：已同意（2026-09-10）  
> 母需求：[`设计契约.md`](./设计契约.md)（构建 / 展示）；可见性粒度：[`../../decisions/011-permission-visibility-no-folder-invite.md`](../../decisions/011-permission-visibility-no-folder-invite.md)  
> 范围：谁可以 **读 / 生成** 图谱；不改节点 schema、dirty 算法、分层 UI。

## 一句话

图谱跟 **域协作身份**（`resolveDomainAccess.kind`），**不跟** 单篇 `document_invites`。  
Invite = 只借正文；**不授图谱**。

## 门禁表

判据以 `resolveDomainAccess(db, domain, domainId, visitorId).kind` 为准：

| 域类型 | 读图谱（GET） | 生成图谱（analyze / 写隐藏缓存） |
|--------|---------------|----------------------------------|
| `private` | 仅 `full`（域主本人） | 同左 |
| `restricted` | 仅 `full`（创建者或 `domain_members`） | 同左 |
| `public` | 非 `none` 即可（通常人人可进） | 同左（「哪个叼毛都能生成」；须已登录且具备可用 AI 配置，与现网一致） |

**明确禁止**：`kind === "viaDocumentInvites"` 在 private / restricted 下读或生成任何目录级、域级图谱（UI 隐藏入口；API 403）。

`full` 含义（代码）：正式协作方——不是「域里有一篇能打开」。见 `src/server/access/domain-access.ts`。

## 为何一刀切（备忘）

共享一份 `___graph___.json` / 域图时：

1. **Invite 按残缺可见集写入** → `dirty=false` → 成员再生成会 skip → 全貌中毒  
2. **成员写入全貌后 Invite 直接 GET** → 读到不可见文章的知识抽象 → 泄密  
3. 读时按节点过滤可行但贵；受限/私有域定位是团队空间，借阅者不需要图谱  

故：partial 可见者在该域 **图谱功能整域屏蔽**。

## 与「文章级生成」关系

- **本期不要求** 上线文章级生成入口。  
- 若未来做文章级：仍建议在 private/restricted 下仅 `full` 可刷；public 可放宽。  
- **不得** 让 `viaDocumentInvites` 写入目录/域共享缓存。

## 构建 walk

`full` 用户生成时：子树按该访客 `canRead` walk。  
对 restricted 成员：合法档位下可见整域，walk ≈ 全貌。  
对 public：按各篇公开档位。

## 实现触达（同意后改代码）

| 位置 | 改动 |
|------|------|
| `graph.routes.ts` | GET/POST analyze 前：解析域 → 非允许 kind 则 403 |
| `graph-task` / `buildDomainGraph` | 生成侧二次校验；域构建须带 `visitorId` 且仅 full（修「拼树不带 visitor」类问题可顺带） |
| `GraphPage.tsx` / 树入口 | private/restricted 下 invite 用户不展示生成/打开图谱 |
| 隐藏文件 permission 行 | **不作为** 图谱鉴权依据；继续派生自域身份 |

错误码建议：`GRAPH_FORBIDDEN`（403），文案区分「请成为域成员」vs「私有域仅主人」。

## 验收

1. restricted：成员可 GET/analyze 域与目录图；仅被 invite 的访客 API 与 UI 均不可。  
2. private：仅域主可；被 invite 读某文的人不可见图谱入口。  
3. public：任意登录访客（有 AI 配置）可生成；可读缓存。  
4. Invite 用户不能通过直接打 `/api/graph/...` 绕过。

## 不做

- 按节点 sources 做读时裁剪（本期用门禁替代）  
- 每访客一份域/目录缓存  
- 开放 Invite 写文章隐藏文件（除非后续单独契约）
