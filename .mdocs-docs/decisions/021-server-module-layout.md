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
    | **application** | 业务编排：每模块 **一个** `<name>.application.ts`（如 `tree.application.ts`），不按细能力拆多文件；组合 service / access；**不** `import` Database |
    | **service** | 基础能力：对本模块持久化或单一外部资源的薄封装，不含复杂编排 |
    | **repo** | 本模块 SQL；**DB 藏在 repo 内**（默认 `getDb()`）。签名可保留可选 `db?: Database`（默认不传），**仅单测注入**；application **永不**传 db |
    | **无表模块** | 无自己的持久化（如 tree）→ **不设 `service/`**，只有 `application/` |

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

  - **模块内 request / response 与 controller 齐平**（面向 Web 的入参/出参形状，不是 RPC DTO，也不叫 `dto/`）：
    - 目录：`modules/<name>/controller/`、`request/`、`response/` 三者平级。
    - `request/`：HTTP body / query / path 的 **class**（`class-validator` 装饰器）；由全局 `ValidationPipe({ transform: true })` 反序列化，controller 直接 `@Query()/@Body() x: XxxRequest`，不手写 `parse*` map。
    - `response/`：该接口返回的数据形状（可选）；controller **`return` 业务结果**，由 `nest/NestWrapDataInterceptor` 统一包 `{ data }`，禁止 `@Res()+res.json`（除非 SSE/文件流）。
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
  nest/                 # Nest 框架装配（与 main 同级）
    nest-attach.ts
    nest-app.module.ts  # 组合根：只注册 controller
    nest-wrap-data.interceptor.ts
    nest-api-exception.filter.ts
    nest-api-ok.ts
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
  | `src/server/identity/` | 今天的访客、令牌、中间件，以后并入 `modules/visitor` |
  | `src/server/access/access-control.ts` | `canReadDocument` / `canEditDocument` |
  | `src/server/documents/document.service.ts` | 今天是编排，目标迁 `modules/documents/application/`；绕圈调 jobs/agent/search 仍待解 |
  | `.mdocs-docs/decisions/020-job-file-vs-watchdog.md` | Job 文件与 watch-dog 的职责，本次不搬 |
