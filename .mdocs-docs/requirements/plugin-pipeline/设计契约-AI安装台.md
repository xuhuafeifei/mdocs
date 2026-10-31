# plugin-pipeline — 增量：AI 安装台（左右布局）

> **状态**：已同意（2026-10-30）· **已统一主 Agent**（`mode=plugin-pipeline` → `/api/agent/chat`；思考/SSE/选择卡与主助手同源；`submit_pipeline` → `pipeline_draft` 刷新右栏）  

> 父契约：[设计契约.md](./设计契约.md)；现行 UI：[设计契约-编排器UI-v2.md](./设计契约-编排器UI-v2.md)  
> 动机：现网「新建 → 编排器 + 可选 AI 描述」对新手过重；自定义安装才是 Agent 主战场。

## 一句话

新建插件顶栏拆成 **AI 帮忙安装 | 手动安装**；AI 路径用 **左 Agent 壳 + 右流程节点**（互不耦合）；编排 Agent 有独立 **session**；一稿一 `pipelineId`；装完留页引导退出。mdocs 智能助手主 panel **不变**。

## 已拍板

| 项 | 结论 |
|----|------|
| 主助手 | **保持现有单 panel**，本期不改入口、不改工具集、不做「聊到一半跳转安装台」。 |
| 市场 · AI 安装 | **左右布局**：左 = **直接嵌 `AgentChatPanel`**（`mode=plugin-pipeline`）；右 = **仅**流程节点可视化。左右 **无业务耦合**。 |
| 顶栏 Tab | **AI 帮忙安装**（默认）｜**手动安装**。切手动才进现有编排器；手动栏 **去掉**「用 AI 描述」。 |
| Session | 编排 Agent **要有上下文 / session**（纠正 v2「无 session」）。建议新 kind：`plugin-pipeline`（与 `normal` / `coding` 并列）。 |
| 再装一个 | **只清右侧草稿 Id / 节点**；**session 由用户自己建/切**，不强制新开。 |
| 右栏数据 | **前端本地草稿**（按 `pipelineId`）；搞完再上传/落盘 YAML；安装进度与日志按 **Id** 反查（与现 job / `plugins.json` 一致）。 |
| 节点出现时机 | **边聊边长**体验最好；**交卷后一次画出**也可接受（可先落地后者）。 |
| 装完 | **留在本页不退出**；UI 固定提示 + system prompt 引导用户主动关或再说「再装一个」。 |
| 市场现成插件 | **维持一键装**；Agent 充其量「帮点安装 + 排错」。难点在 **自定义编排**，那才是 Agent 主责。 |
| 手动 Tab | **完整保留现编排器**；可选快捷：**选模板 → 预填步骤 / 表单**（如二进制 MCP：download→extract→upsert_mcp，用户只填 URL 等）。 |

## 方案摘要

### 信息架构

```
插件市场
  └ 新建插件
       ├ Tab：AI 帮忙安装（默认）
       │     ┌──────────────┬────────────────────┐
       │     │ 左：Agent 壳 │ 右：流程节点（草稿） │
       │     │ session 列表 │ 仅可视化 / 装按钮   │
       │     │ 消息 + 输入  │ 与左栏无耦合        │
       │     └──────────────┴────────────────────┘
       └ Tab：手动安装
             → 现有编排器（可选：模板预填入口）
             → 无「AI 描述」入口
```

- **已安装 / 可安装** 卡片行为不变（一键装/卸、详情、编辑流水线）。
- 自定义从零编排：优先走 AI Tab；高级用户走手动 Tab。

### 左栏（Agent 壳）

- **视觉与交互**对齐智能助手（消息列表、输入、思考折叠、未配模型引导、session 列表若壳子已有则复用形态）。
- **后端**与主助手同一条 `run.ts` / `/api/agent/chat`；用 **`mode=plugin-pipeline`** 换 system prompt + 工具集（探测 + `ask_user_choice` + `submit_pipeline`），**不**挂手册/账号/MCP。无独立 `/ai/draft`。
- 工具边界：临时工作区探测（exec / download / fetch / list / read）+ 交卷；**禁止**直接往用户正式 install 目录乱写；真安装仍走解释器。
- System prompt 须写明：装成功后引导用户关闭安装台或开新草稿；不要假设会自动跳转。

### 右栏（流程节点）

- **唯一职责**：展示 **当前草稿** 的 probe / steps（及安装中的逐步状态）。
- 与左栏 **无共享 React 状态契约**（不把节点嵌进气泡）。刷新方式二选一或组合：  
  - Agent 交卷 / 工具成功后前端拿 YAML 或结构化草稿渲染；  
  - 或轮询/订阅「当前 `pipelineId` 草稿」。  
- **一屏一稿**：右侧只绑一个 `pipelineId`。  
- **再装一个 / 新开插件**：重置右侧 Id → 空节点图；不堆多插件节点。  
- 草稿校验通过后，右栏（或底栏）提供 **安装**；进度仍可复用现安装 runner（按 Id 查 job）。

### `pipelineId` 与存储

| 阶段 | 存哪 | 说明 |
|------|------|------|
| 编辑中 | 前端本地草稿（可再同步服务端草稿文件） | key = 新 roll 的 `pipelineId` |
| 提交定义 | `plugins/.../<id>/pipeline.yaml` | 与现流水线资产一致 |
| 安装中 | 内存 `PipelineJob`（按 visitor + id + action） | 重启丢失；UI 轮询 |
| 已安装 | `plugins.json` → `pipelines.installed` + history | 持久索引 |
| 产物 | `plugins/install/<id>/`、MCP/skill、soul 旁路等 | 与现执行器一致 |

装成功后的大改：进 **手动编排器**，或当新插件（新 Id）。不在「已安装实例」上原地玩节点图。

### Session（`plugin-pipeline`）

- 复用 `AgentSessionManager` 的落盘 / 列表 / 压缩能力，扩展 kind。
- 与 `normal` / `coding` **隔离目录或 meta**，避免会话列表混进主助手。
- 用户可多轮改同一草稿；「再装一个」**不**自动 `createSession`。

### 与 v2 AI 的差异

| v2（现行） | 本增量 |
|------------|--------|
| 编排器内嵌 AI 草稿面板；无 session | 市场新建 AI Tab；左右台；`plugin-pipeline` session |
| 独立 `/ai/draft` 一轮交 YAML | 主 Agent 多轮对话 + `submit_pipeline` → 右栏 |
| 装要另回编排器/市场点 | 右栏直接装；装完留页 |
| 新建向导可附「AI 描述」 | AI / 手动顶栏拆开；手动无 AI 描述 |

## 非目标（本期）

- 改 mdocs 智能助手主 panel 或主助手工具集。  
- 主助手会话半路打开安装台 / 意图搬运。  
- 右栏堆多个插件的节点。  
- 强制「再装一个」新开 session。  
- 边聊边长节点（可作为后续增强；本期可交卷后一次渲染）。

## 变更触达（预估）

| 区域 | 说明 |
|------|------|
| `src/web/app/plugins/*` | 新建顶栏 Tab；AI 安装台左右布局；弱化/移除编排器内嵌 AI 描述入口；可选模板预填 |
| Agent 壳复用 | 抽或复用聊天壳组件；**不**改主助手 FAB 行为 |
| `src/server/agent/Agent/session-manager.ts` 等 | 新增 kind `plugin-pipeline` |
| Agent | `mode=plugin-pipeline` → `/api/agent/chat`；`tools-pipeline` + `draft-normalize` |
| `pipeline-ai-tools.ts` | 探测实现；由主 Agent 工具包装调用 |
| 安装 | 复用 `pipeline-job` / `executor`；右栏触发 install |
| i18n | 新文案（Tab、留页提示、再装一个） |
| 本需求文档 | 同意后更新 `代码索引.md` / 必要时 `map/` |

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| 抽 Agent 壳牵动主助手回归 | 壳抽离保持主助手 API 不变；主路径单测/手测 |
| kind 扩展漏改列表/压缩 | 集中改 session-manager 与路由鉴权 |
| 左右「看起来像联动」实则只靠草稿 Id | 文档与 UI 文案写清；交卷失败右栏不假装有节点 |
| 新手仍摸到手动编排器 | 默认 AI Tab；手动作进阶 |

回滚：隐藏 AI 安装台 Tab，恢复 v2 编排器内嵌 AI 面板即可（执行器可保留）。

## 测试要点

- [ ] 主助手 FAB / 会话 / 工具与改前一致。  
- [ ] 新建默认进 AI Tab；手动无「AI 描述」。  
- [ ] 左栏多轮改草稿；切 session 不丢用户自管历史。  
- [ ] 再装一个：右栏 Id 与节点清空；旧 session 仍在。  
- [ ] 交稿后右栏可装；装完留页有引导文案。  
- [ ] 市场 Engram 等一键装路径不变。  
- [ ] （若做模板）手动选模板预填步骤可进编排器细改。

## 依据

- 会话拍板（2026-10-30）：信息架构纠正「左右无耦合 / 主助手不动 / session 用户控」。  
- 现行实现：`AiInstallBench` + `AgentChatPanel(mode=plugin-pipeline)`、`tools-pipeline.ts`、`pipeline-job.ts`、`AgentSessionManager` kind=`plugin-pipeline`。  

- 父契约与 v2 UI 契约见文首链接。
