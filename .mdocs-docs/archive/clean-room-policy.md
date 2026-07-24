# Clean-room Policy

> 本文回答：mdocs 与 `markdown-docs`（前项目）的代码隔离红线在哪里，哪些可以复用、哪些绝对禁止。

## 背景

`mdocs` 是从零重新实现的 Markdown 知识库。作者之前维护过 `markdown-docs`（位于 `~/ddmc/markdown-docs`），但 `mdocs` 必须与其保持代码层面的完全隔离。

## 禁止复用（绝对红线）

以下任何内容**不得**从 `markdown-docs` 复制或改写：

- 源文件、函数、类、接口、类型定义
- SQL 语句或 Schema 定义
- React 组件、Hooks、CSS 样式
- 工具函数和配置结构
- API 路由组织方式或身份逻辑

## 允许复用

- **`agent-demo` 的 logger 设计**：因为这是作者自己的 demo 项目，拥有完全版权。
- **Meta2d / Vditor 流程**：以下特定模式允许与 `markdown-docs` 保持一致：
  - `useFlowRenderer`
  - `registerPens`
  - fenced `` ```meta2 `` 代码块 + 内联 JSON
  - **wysiwyg 模式**（不是 IR 模式）
  - SVG 预览（每个代码块的预览半区）
  - `window.vditorInstance` 上的 `getValue` / `setValue`（用于编辑或删除图表块时回写）

## 实践建议

1. **重构前自查**：如果要提取公共逻辑，先确认它不是从 `markdown-docs` 记忆中重构出来的。
2. **AI 协作时声明**：向 AI 提供上下文时，明确说明「这是 clean-room 项目，不能参考 markdown-docs 的代码」。
3. **新功能优先创新**：即使功能类似，也应在接口设计、数据结构、实现路径上做出差异。

## 与 `fgbg/` 的关系

`fgbg/` 目录存放 AI 协作过程中的设计初稿，本身不受 clean-room 约束（它是思考过程），但**最终进入 `src/` 的代码必须是通过 clean-room 方式编写的**。
