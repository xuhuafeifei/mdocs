# 021 — server 按 infra / modules 拆，调用只允许从上往下

- **状态**：accepted（2026-11-12；2026-11-13 修订模块内分层、DB/事务规矩、access 三权与 Nest AOP）。本次以契约为准；代码按迁移策略渐进。
- **上下文**：`src/server/` 同时按技术层（`routes/`、`db/`）和业务目录切开，调用互相指。曾经把权限和鉴权放进基建，理由是很多模块都要用。也曾保留一个 `identity` 模块，把访客、令牌和中间件捆在一起。初版把记录类模块写成 controller / service / repo，但仓库里 `*.service.ts` 实际在做用例编排，和「service = 基础能力」语义冲突。
- **决策**：
  - **顶层三类目录（含义固定）**：
    | 目录 | 是什么 | 不是什么 |
    |------|--------|----------|
    | **`modules/`** | 系统**业务**（文档、树、域、权限、Agent…） | 不是框架、不是 SQLite 连接 |
    | **`infra/`** | 业务运行所需的**系统基础**（db / storage / logger / 协议级 http 辅助 / task-queue / config） | 不写业务规则；不依赖 `modules` |
    | **`nest/`**（与 `main.ts` 同级） | 代码运行所需的**框架级装配**（attach、根 Module、全局 Pipe/Interceptor/Filter） | 不是业务包；不塞进 `infra/http`；禁止 `modules/*/nest/` |
  - `modules` 可以依赖 `infra`。`infra` 不依赖任何业务模块。`nest` 可依赖 `modules`（组合根注册 controller）与 `infra`。
  - 不设 `utils`，不设 `modules/common`。被多处使用不是进 `infra` 的理由。
  - 不设 `identity`。注册、登录、恢复码、改密码、按令牌查出访客归 `modules/visitor`。令牌哈希和 CLI token 放在这个模块里，不单开 `token`。鉴权中间件也放在这里，它不是独立业务。
  - **`access` 与 `documents` 平级**；**暂不划** `controller/application/service` 子目录，先保持扁平。对外门面见 ADR 022：`canEnterDomain` / `canRead` / `canWrite`（及 `assert*`）**只收 id**，内部查库；Nest Guard 薄适配。旧行级 `canReadDocument(row,…)` 迁移期保留。
  - **记录类模块内部分层**（从上往下，禁止反向依赖）：

```text
controller  →  application  →  service  → （repo / 文件 / 外部）
```

    | 层 | 职责 |
    |----|------|
    | **controller** | HTTP 进出：路由、Guard、校验 request 后交给 application，`return` 业务结果 |
    | **application** | 业务编排：每模块 **一个** `<name>.application.ts`（如 `tree.application.ts`），不按细能力拆多文件；组合 service / access / **mapper**；**不** `import` Database；**本身不做数据组装**（字段拼装、row↔对外形状交给 mapper） |
    | **mapper** | 本模块数据映射（`modules/<name>/` 内，如 `*.mapper.ts` 或 `mapper/`）：入参→落库行、row→对外形状等。函数名写清方向（`toXxxRow` / `toXxxPublic`）。**只服务本聚合**；跨模块实体互转不是 mapper，是 application 编排 |
    | **service** | 基础能力：对本模块持久化或单一外部资源的薄封装，不含复杂编排；接收 application 经 mapper 组装好的数据（或自行再调 mapper，见下 to-do 落地时对齐） |
    | **repo** | 本模块 SQL；**DB 藏在 repo 内**（默认 `getDb()`）。签名可保留可选 `db?: Database`（默认不传），**仅单测注入**；application **永不**传 db |
    | **无表模块** | 无自己的持久化（如 tree）→ **不设 `service/`**，只有 `application/`（需要形状转换时可有轻量 mapper） |

  - **mapper 调用链（已拍板，代码待拆）**：

```text
application  ──调──►  mapper（组装 / 映射）  ──结果──►  service  ──►  repo
```

    - application **只编排**：决定顺序、调谁；需要落库形状或对外形状时 **调用 mapper**，把结果传给 service。
    - application **禁止**在体内手写 `{ ... }` 拼 insert 行、或散落 `row → public` 字段搬运。
    - 不拆三套目录（to-sql / to-response / entity-entity）；一个模块内一个 mapper 文件（或小目录）即可，靠函数名区分方向。
    - 跨聚合：application 调多个 service 组合，**不**用 A→B 万能 mapper。

  - **事务规矩**：`infra/db` 提供函数式 `runInTransaction(() => { ... })`（内部取连接并 `db.transaction`）。application 组合多个 repo 需要原子性时只调该函数；**不把 Database 暴露给业务层**。单例连接下，事务回调里 repo 再 `getDb()` 仍属同一事务。
  - **迁移策略**：先迁 controller，顺路审视依赖；再把编排抽到 `application/`，service 削薄。`tree` 目标 `modules/tree`（仅 application）；过渡期可暂挂 documents。依赖：documents（列文）+ domains（查域）+ access（过滤）→ tree.application 建树；**删除胖 `tree.service`**。
  - **`access` 三权（契约能力，名称可与现码对齐）**：
    1. **能否进入 domain**（现有方向：`canEnterDomainTree` / domain entry）
    2. **能否 read 文章**（`canReadDocument`）
    3. **能否 write 文章**（`canEditDocument`，对外语义称 write）
    同一套函数：**application 直接引用**（如 tree 过滤列表）；**controller 用 Nest Guard 横切**（单资源：路由上的 `domainId` / `documentId`）。Guard 只是对这三权的 HTTP 适配，规则本体只活在 `access` 一份。
  - **Nest AOP 有哪些（请求管道）**：
    | 机制 | 典型用途 |
    |------|----------|
    | **Guard** | 鉴权 / 授权（进域、读文档、写文档）← 三权挂这里 |
    | **Pipe** | 入参校验与变换（`ValidationPipe` + request class） |
    | **Interceptor** | 前后环绕：统一 `{ data }`、日志、缓存；**不做**列表级 canRead 过滤 |
    | **Exception Filter** | 统一 `{ error: { code, message } }` |
    列表过滤、批量可见性仍在 application 里调 `access`，不塞进 Interceptor。
  - **访客注入（禁止 controller 摸 `req.visitor`）**：
    - Express `authMiddleware` 仍负责解析 token → `req.visitor`（全部 Express router 迁完后再做 Nest 原生 auth）。
    - `nest/attach.ts` 用 middleware 把 `req.visitor` 写入 `VisitorContext`（ALS）；Guard 早于 Interceptor，故不用 Interceptor 写 ALS。
    - Controller 用 `@VisitorId()` / `@OptionalVisitorId()` / `@CurrentVisitor()`；**application 显式传 `visitorId`**，禁止 import `nest/context`（modules 不依赖 nest）。
    - 例外：cookie / 文件流仍可用 `@Res({ passthrough: true })`（Response，不是 Request 身份）。

  - **`nest/` 内部目录（按管道职责；根上只留启动入口 + 组合根）**：

```text
nest/
  attach.ts                 # 挂 Express、写 ALS、装全局 Pipe/Interceptor/Filter
  app.module.ts             # 组合根：只注册 controller

  context/                  # 请求作用域存储（ALS）；不是 AOP
    visitor.context.ts
  decorators/               # ParamDecorator；读 context
    visitor.decorators.ts
  guards/                   # RequireVisitor / CanEnterDomain / CanRead / CanWrite
  interceptors/
    wrap-data.interceptor.ts
  filters/
    api-exception.filter.ts
  http/
    api-envelope.ts         # ApiOk / ApiErr
```

    - 落位：Guard → `guards/`，Interceptor → `interceptors/`，Filter → `filters/`，ParamDecorator → `decorators/`，请求作用域存储 → `context/`。
    - 进子目录后文件名不加 `nest-` 前缀；类名同理（如 `RequireVisitorGuard`）。
    - **禁止**在 `nest/` 根堆零散文件；**禁止** `modules/*/nest/`。将来 Nest 原生 auth 再开 `middleware/`，现阶段不建空目录。

  - **模块内 request / response 与 controller 齐平**（面向 Web 的入参/出参形状，不是 RPC DTO，也不叫 `dto/`）：
    - 目录：`modules/<name>/controller/`、`request/`、`response/` 三者平级。
    - `request/`：HTTP body / query / path 的 **class**（`class-validator` 装饰器）；由全局 `ValidationPipe({ transform: true })` 反序列化，controller 直接 `@Query()/@Body() x: XxxRequest`，不手写 `parse*` map。
    - `response/`：该接口返回的数据形状（可选）；controller **`return` 业务结果**，由 `nest/interceptors/WrapDataInterceptor` 统一包 `{ data }`，禁止 `@Res()+res.json`（除非 SSE/文件流）。
    - controller 校验 request 后，把**已净化的字段**传给 application；application / service **不 import** `request/`、`response/`。
    - 跨模块调用走 application/service 的函数参数与返回值（领域形状），不传 HTTP request/response。
  - **`agent` 例外形态**：内部保持函数管道（run / tools / session），不硬套「每个文件都叫 application/service」。语义上它仍是 **application 级编排**：组合 documents / search / access 等模块的基础能力。对话 Agent 和以后调度器拉起的 Agent 都在 `modules/agent/`。
  - 业务模块之间单向、无环。允许的调用：

```text
infra
  db / storage / logger / http / task-queue

nest/   # 框架装配，与 main 同级；不是 infra，不是业务 module

visitor ──→ domains
access

documents ──→ domains
documents ──→ access
search ──→ access
documents ──→ search          只为通知索引。search 不能再调用 documents

agent ──→ documents、search、access、domains、visitor
plugins、mcp、memes           agent 可以调用它们；它们不调用 agent

watch-dog（以后）──→ agent    不碰文档文件，也不被 documents 调用
```

  - `src/server/jobs/` 先留在原地。Job 文件与调度的拆分见 ADR 020。
- **后果**：
  - 搬目录时按上面的树挪，不把 `access` 或鉴权放进 `infra`。
  - 现有 `*.service.ts`（如 `document.service.ts`）多半应迁到对应模块的 `application/`；真正的薄 DB/文件封装再落到 `service/`（或 `repo/`）。搬迁按模块渐进，不要求一次改完。
  - 现有 `documents` → `jobs`、`documents` 里的建议说明去调 `agent`，与这张图相反，留到拆 watch-dog 时再解开。
- **目录**：

```text
src/server/
  main.ts
  cli/
  nest/                 # Nest 框架装配（与 main 同级）；内部见上文「nest/ 内部目录」
    attach.ts
    app.module.ts
    context/ decorators/ guards/ interceptors/ filters/ http/
  infra/
    config/
    db/
    storage/
    logger/
    http/               # 协议级辅助，不含 Nest
    task-queue/
  modules/
    visitor/
    access/             # 暂扁平；三权 + 日后 Nest Guard 适配
    domains/
    tree/               # 无表：controller/ + request/ + tree.application.ts
    documents/
      controller/
      request/
      response/
      documents.application.ts   # 每模块一个 * .application.ts
      service/                   # 或 documents.service.ts
      # repo 可并在 service 下，或单独 *.repo.ts
    search/
    agent/           # 函数管道；语义上 application 编排
    plugins/
    mcp/
    memes/
```

- **落点**：
  | 位置 | 说明 |
  |------|------|
  | `src/server/modules/visitor/` | 原 `identity` 已迁入；`controller/` + `visitor.application.ts` + request 已立；Express `visitors.routes` 已删；service/cli-token/token/middleware 仍扁平 |
  | `src/server/access/access-control.ts` | `canReadDocument` / `canEditDocument` |
  | `src/server/documents/document.service.ts` | 今天是编排，目标迁 `modules/documents/application/`；绕圈调 jobs/agent/search 仍待解 |
  | `.mdocs-docs/decisions/020-job-file-vs-watchdog.md` | Job 文件与 watch-dog 的职责，本次不搬 |
- **已拍板（2026-11-13）— visitor 凭证聚合**：
  - `visitor`（人）/ `visitor_sessions`（登录会话）/ `cli_tokens`（CLI 凭证）/ `token.ts`（哈希工具）**同属 `modules/visitor`**，不平级拆 `modules/cli-token` 或 `modules/token`。
  - 理由：模块按「同一实体相关能力」聚合；二者都服务于 visitor。表可分、模块不分。包内 `cli-token → visitor` 单向即可。
  - **鉴权不装进业务聚合的永久位置**：`auth.middleware` **未来拆出** → Nest **Guard**（白名单豁免强制登录；不是 Interceptor）。迁走后 visitor 模块只剩「人 + 凭证」。
- **技术债 / to-do（2026-11-13 记）**：
  1. **`infra/db/repositories/*` 放错层**——契约要求 repo 在对应 `modules/<name>/` 下；`infra/db` 只留连接 / schema / `runInTransaction`。现堆在 infra 是历史债，**等 Express `routes/` 全部干掉后再按模块搬回**。
  2. **`auth.middleware` → Nest Guard**——现 `src/server/modules/visitor/auth.middleware.ts`（Express）；目标：全局/路由 Guard + 白名单（对齐现 `EXEMPT_PATHS`）；Interceptor 只做 `{ data }` 等环绕，不做登录拦截。触发：router 迁 Nest 过程中顺手拆，或 routes 清空后专项。
  3. **各 module 引入 mapper，application 下沉数据组装（以后再拆）**——现状：组装散落在胖 service / 薄 application 转发里。目标：`modules/<name>/*.mapper.ts`（或 `mapper/`）；application 调 mapper 得到组装结果再传 service；application 自身不拼装。优先从 visitor / documents 试点，不阻塞当前 router→Nest 迁移。
  4. mdocs 活备注：本地 `迁移方案/服务端目录迁移备注`（`e1052e98-…`）；远端 `重构文档`（`3e271553-…`）。
