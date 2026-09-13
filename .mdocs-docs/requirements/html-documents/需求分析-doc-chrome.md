# HTML 文档 — 二期（DocChrome / 顶栏能力）需求分析

> 一句话：HTML 与 Markdown **共用文档顶栏壳**；顶栏能力（尤其 AI 帮写）由 **file_type 政策表** 显隐；帮写按 HTML 原文进 / 原文出。  
> 状态：**已同意**（2026-09-11） · 挂在既有夹 [`html-documents/`](./)（一期已同意），**不**另开 `html-v2`。设计见 [`设计契约-doc-chrome.md`](./设计契约-doc-chrome.md)。

## 背景

一期已交付：html 创建 / 树 / 原文草稿与 merge / iframe 预览 / 政策表热点。  
HtmlEditor 自带迷你顶栏（编辑·预览·发布），与 DocumentEditor 的「标题 / 域 / 帮写 / 同步 / 收藏 / 删除 / 文档信息」不一致。

讨论结论：不一致不是因为「复用会炸」，而是一期刻意切薄；二期应抽 **DocChrome**，并让帮写等入口挂政策表，而不是在组件里写死 `if (html)`。

## 目标

1. 抽出 **DocChrome**（文档顶栏）：**桌面 + 手机 reader 同一组件**
2. md / html 共用 DocChrome；正文按 **`fileType`** 选择编辑器（删除政策表 `editor` 列）
3. **权限与 md 无区别**；评论按 documentId，html **同样支持**
4. 帮写：权限无差；**html 也开放入口**（`aiWrite: true`）——进场以 HTML 原文为 seed，完成写回 HTML 草稿（见「落地修正」）
5. 政策表增 `aiWrite`、`comments` 等能力列，DocChrome 读表显隐

## 非目标（二期不做）

- Lobe 格式工具条进 DocChrome
- Monaco / WYSIWYG / `allow-scripts`
- 另起插件注册中心；继续用 `file-type-policy` 管 **类型能力**（不管挂哪个编辑器品牌）

## 「html 帮写」落地修正（2026-09-13）

原分析里写的是「html 暂关帮写」（`aiWrite: false`），**实际落地改为开放**，理由与做法：

| 项 | 落地值 |
|----|--------|
| 政策表 | `html.aiWrite = true` |
| 进场 | 工作台仍是 Markdown 对话，但 seed 用 **HTML 原文** |
| 写回 | 原样写回 `contentKind=html` 草稿，不做 MD↔HTML 静默转换 |
| 落点 | `src/web/app/ai-write/htmlAiWrite.ts`（`htmlToAiWriteSeed` / `aiWriteResultToHtml`） |
| 未引入 | `aiWriteFormat` 列（当前不需要，原文进原文出即可） |

原「先 off 再开」的三条判断（是 / 不是 / 以后打开）随之作废。

## 验收

1. 打开 html：顶栏与 md 对齐（含手机 reader）；**有**评论；**有**帮写按钮
2. 打开 md：帮写 + 评论与现网一致
3. html 权限/邀请/改权限与 md 同路径可用
4. html 默认预览；预览/编辑切换不误跳回
5. 政策：`html.comments===true`，`html.aiWrite===true`
6. 手机 html：操作栏默认折叠、Header 占位不悬浮

## 依据

- 一期：[设计契约](./设计契约.md) · [代码索引](./代码索引.md)
- 顶栏现状：`DocumentEditor.tsx` 工具栏；迷你栏：`HtmlEditor.tsx`
- 政策表：`src/shared/file-type-policy.ts`
