# graph-task-id-dir-vs-folder-mismatch

> 一句话：目录入队误标为 `doc`，前端轮询 `graph:dir:*` 得到 `not_found`，进度条闪退后空态。

## 现象

点击「生成图谱」后进度面板短暂出现即消失，回到「还没有知识图谱」。  
Network 中 `GET /api/graph/tasks/graph:dir:<folderId>` 返回 `status: "not_found"`。

## 根因

1. DB / `FILE_TYPE.FOLDER` 的值是 **`"dir"`**。
2. `graph.routes.ts` 入队时写成 `file_type === "folder"`，恒为 false → `type: "doc"` → 任务 ID 为 `graph:doc:<id>`。
3. `GraphPage` 固定用 `graph:dir:<id>` 轮询 → 队列与日志都对不上 → `not_found` → `isProcessing` 变 false。
4. 后台任务其实仍在跑（本例约 166s 后成功写出 `___graph___.json`），但前端从未收到 `completed`，不 `reloadGraph`。

举证：`~/.mdocs/task-logs/graph:doc:6c0b1d0b-….log` 存在且 `task.completed`；轮询 ID 却是 `graph:dir:…`。

## 方案

| 改动 | 说明 |
|------|------|
| `graph.routes.ts` | `file_type === FILE_TYPE.FOLDER`（`"dir"`）再入队为 `dir` |
| `GraphPage.tsx` | 入队后用返回的 `taskId`（`taskIdRef`）轮询 |
| `endpoints.ts` | `encodeURIComponent(taskId)` |

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `src/server/routes/graph.routes.ts` | `POST /:folderId/analyze` | 修正 type |
| `src/web/app/GraphPage.tsx` | `taskIdRef` / `handleAnalyze` | 轮询真实 taskId |
| `src/web/services/endpoints.ts` | `getGraphTaskApi` | URL 编码 |
| `src/shared/file-types.ts` | `FILE_TYPE.FOLDER` | 值为 `"dir"`（依据） |

## 验证

- [ ] 对目录点生成：任务日志文件名为 `graph:dir:<folderId>.log`
- [ ] 轮询同一 ID，进度保持到完成并自动刷出图谱
- [ ] 「分拣调度」已有 `___graph___.json` 时，刷新页面应能直接读出（无需重跑）

## 可复用模式

- 比较 `file_type` 时一律用 `FILE_TYPE.*` / `isFolderFileType`，禁止字面量 `"folder"`。
- 异步任务：轮询 ID **以 enqueue 返回为准**，前端勿自行拼装猜测。
