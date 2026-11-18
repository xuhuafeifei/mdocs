# 023 — Entity / Row / Request / Response 命名

- **状态**：accepted（2026-11-18）
- **上下文**：「我的文章」列表把表行、JOIN 投影、驼峰 HTTP 出参、分页壳、内存 groupBy 全塞进 repo；命名混用 DTO/VO/投影，和 SQL 列（蛇形）与 Web JSON（驼峰）也对不齐。
- **决策**：
  - 层名只用四套，**不用 VO / DTO**：
    | 名 | 含义 | 风格 |
    |----|------|------|
    | **Entity** | 表 1:1（如 `Documents`） | 蛇形 |
    | **Row** | SQL/JOIN 查询投影（如 `DocumentsOwnerRow`） | 蛇形 |
    | **Request** | HTTP/工具进参（如 `PageRequest`、`ListMyDocumentsRequest`） | 驼峰 |
    | **Response** | HTTP/Agent 出参（如 `MyDocumentResponse`） | 驼峰 |
  - **mapper**：`Row → Response`（及入参→落库形状）；repo **只**跑 SQL，返回 Entity/Row。
  - 分页：入口校验（HTTP：`PageRequest` + ValidationPipe；Agent：`resolvePageParams`）；非法直接失败，不钳位。repo / application 只吃已合法的 `{ offset, limit }`。
  - 「我的文章」后端去掉 `groupBy`/`groups`（本页 UI 分节不进 API）。
- **后果**：
  - 正面：repo 可测、可瘦；命名与 ADR 021 的 controller→application→mapper→service→repo 一致。
  - 负面：旧名 `DocumentWithDomain` 等需渐进改成 Response；前端未用 i18n 分组文案可后清。
  - 风险：Agent 与 HTTP 须共用同一套 page 规范化，避免分叉。
