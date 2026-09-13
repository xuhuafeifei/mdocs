# HTML 文档二期 — DocChrome 设计契约

> **状态**：已同意（2026-09-11，开始实现）  
> 配套：[需求分析-doc-chrome](./需求分析-doc-chrome.md) · 一期：[设计契约](./设计契约.md)

## 方案摘要

1. **DocChrome**：从 DocumentEditor 抽出「文档顶栏」成独立组件；与 Lobe Toolbar / Html 源码区无关。**桌面 + 窄屏 reader 同一组件**（手机阅览在范围内）。
2. **选编辑器**：按 **`fileType`** 挂正文（`md` → DocumentEditor，`html` → HtmlEditor）。**不**再经 `policy.editor` 派发；二期 **删除** 政策表 `editor` 列。
3. **权限模型**：html 与 md **无区别**（同一套 owner / PUBLIC_* / INVITE / 域规则）。顶栏能力是否开放，**不能**用「权限不同」当理由。
4. **评论**：挂在 `documentId` 上，与正文格式无关 → 二期 html **与 md 一样支持**（侧栏评论面板 + 顶栏入口）。
5. **帮写**：权限无差；工作台仍为 Markdown。html **开放入口**（`aiWrite: true`）：进场以 HTML 原文围栏为 seed；完成时 MD→HTML（或整篇 ```html / `<html>`）写入 `contentKind=html` 草稿。
6. **政策表**：只表达类型能力 / 数据管道；`aiWrite`、`comments`；DocChrome 读表显隐。

### 为何去掉 `policy.editor`

| 问题 | 说明 |
|------|------|
| 表是「文件类型政策」 | 列应描述 **这类文件能做什么 / 数据怎么走** |
| `editor: 'lobe'` | 是实现/组件名，不是文件类型 |
| 选编辑器 | `fileType → UI`，放前端分支即可 |

保留：`draftKind` / `mergePipeline` / `writeNormalize`（内容形态与管道）。

### 评论 vs 帮写（澄清）

| | 与权限 | 与格式 | 二期 html |
|--|--------|--------|-----------|
| 评论 | 无关（同 documentId） | 无关 | **支持** |
| 帮写 | 无关 | **强相关**（现管道只懂 Lexical/md） | **入口关闭**；开入口 = 另做落盘管道 |

一期契约把「评论」写进非目标，是 **砍范围**，不是模型限制；二期纠正。

---

## 已拍板候选（请确认）

| 项 | 提案 |
|----|------|
| 抽层范围 | **桌面 + 窄屏 reader 同组件**（手机阅览必做） |
| 编辑器分支 | **`fileType === 'html'` → HtmlEditor，否则 DocumentEditor** |
| 政策表 `editor` 列 | **删除** |
| 权限 / 文档信息 / 邀请 | html **完整复用**（与 md 同权） |
| 评论 | html **支持**；政策 `comments: true`（md/html） |
| 帮写 | 仅 `policy.aiWrite && onAiWrite`；**md=true，html=true**（工作台仍为 Markdown，进场/写回按 HTML 原文，见决策 5） |
| 标题失焦 | DocChrome 回调；策略跟调用方（与现 md 对齐） |
| 预览/编辑 | html：**滑动开关**（左编辑 / 右预览），只切正文；**发布/删除常驻**（不跟开关显隐）；不再用 DocChrome 右侧「进入编辑」 |
| 默认打开 | html 仍强制预览，忽略 `autoEdit` |

---

## 政策表增量

| 字段 | 类型 | md | html | 其它 |
|------|------|----|------|------|
| `aiWrite` | `boolean` | `true` | `true` | `false` |
| `comments` | `boolean` | `true` | `true` | `false` |

**明确不下沉到政策表**

- 预览/编辑切换、Lobe 格式工具条

html 帮写的「原文进 / 原文出」由 `ai-write/htmlAiWrite.ts`（`htmlToAiWriteSeed` / `aiWriteResultToHtml`）承担；当前不引入 `aiWriteFormat` 列。

---

## DocChrome 职责边界

### 负责

- **桌面**与 **窄屏 reader** 两套布局（同一组件内分支）
- leading：标题、域、帮写（读 `aiWrite`）、extra  
- trailing：收藏、同步、发布、删除、进入编辑、评论（读 `comments`）、文档信息、extra  
- reader：汉堡回目录、标题、域、发布；「更多」里收藏/删除/文档信息等用 slot 或内置菜单

### 不负责

- Lexical / textarea / iframe 正文  
- 自动保存、冲突 merge、帮写全屏层、评论列表面板内部实现  
- 权限/邀请 API（由父组件注入菜单内容）

### 关键 props（示意）

```text
fileType, displayName, onDisplayNameChange, onDisplayNameBlur
domains, currentDomainId, onDomainChange, onDomainsChange
canEdit, editing, onEnterEdit
onAiWrite?          // 且 policy.aiWrite
onSyncClick?, syncBehind?
onPublish?, onDelete?, busy?, draftExists?
onToggleBookmark?, isBookmarked?, bookmarkBusy?
onToggleComments?, commentPanelOpen?, commentCount?  // 且 policy.comments
docInfoSlot / docInfoMenu
leadingExtra?, trailingExtra?
readerChrome?, onOpenMobileNav?, reader 手势相关可选
```

---

## 与一期结构关系

```text
一期：App → HtmlEditor（迷你顶栏）| DocumentEditor（完整顶栏 + Lobe）
二期：按 fileType 选正文；共用 DocChrome（含手机 reader）
        md   → DocChrome + DocumentEditor 正文 + CommentsPanel（可开）
        html → DocChrome + HtmlEditor 正文 + CommentsPanel（可开）
        帮写入口 md 与 html 都开（aiWrite=true）；html 走原文进/原文出
```

---

## 变更触达

| 文件 | 改动 |
|------|------|
| `src/shared/file-type-policy.ts` | 删 `editor`；增 `aiWrite`、`comments` |
| `src/shared/file-type-policy.test.ts` | 锁上表 |
| `src/web/app/DocChrome.tsx` | **新建**（桌面 + reader） |
| `src/web/app/DocumentEditor.tsx` | 顶栏改 DocChrome |
| `src/web/app/HtmlEditor.tsx` | 去迷你顶栏；接 DocChrome + extra |
| `src/web/app/App.tsx` | fileType 分支；html 接评论面板与 chrome 回调；html 帮写 seed/写回 |
| `src/web/app/ai-write/htmlAiWrite.ts` | **新建**：`htmlToAiWriteSeed` / `aiWriteResultToHtml`（原文进/原文出） |
| 代码索引 / mdocs-site | 同步：html 有评论、有帮写 |

---

## 手机端行为（2026-09-13 补）

| 项 | 契约 |
|----|------|
| HTML 默认模式 | **默认预览**（`previewMode` 初值 `true`，且切文档时重置为 `true`）。一期是「默认预览」但实现里被 `setPreviewMode(false)` 覆盖成编辑，已修 |
| 手机 Header 形态 | **占据空间（docked）**，与面板贴合；不悬浮在内容上。实现传 `readerHeaderDocked={props.readerChrome}` |
| 操作栏折叠 | `readerChrome` 下拆两行：第一行「汉堡 + 标题 + 展开按钮 + ⋯」常显；第二行「域选择 + leadingExtra + 发布」**默认折叠**，点展开按钮显示 |
| 预览/编辑入口 | 手机端放 **⋯ 三点菜单**内（两项，当前模式 disabled）；桌面端放顶栏分段控制器 |
| 编辑/预览控件 | 桌面端为 **iOS 风格浅色分段控制器**（`#F2F3F5` 底 + 白色滑块），非两个实心按钮、非深蓝滑动开关 |
| 重复入口 | HTML 不传 `onEnterEdit`，避免预览模式下顶栏右侧再出现一个绿色「编辑」按钮 |

---

## 风险

| 风险 | 缓解 |
|------|------|
| 顶栏与权限/邀请耦合 | DocChrome + slot |
| 误以为 html「不支持帮写」 | `aiWrite=true`；走 `htmlAiWrite` 原文进/原文出 |
| reader 与桌面行为分叉 | 强制同组件，验收含窄屏 |
| 手机操作栏挤爆 | 第二行默认折叠 + 横向滚动 |

---

## 测试要点

1. md：帮写可见；评论可用
2. html：帮写 **可见**；评论 **可用**（与 md 同 API）
3. html：域 / 同步 / 发布 / 删除 / 收藏 / 文档信息（邀请·权限）可用
4. 窄屏：html/md 均走 DocChrome reader，可回目录、发布
5. 政策单测：`html.aiWrite===true`，`html.comments===true`
6. 手机 HTML：进入即预览；Header 占位不悬浮；操作栏默认折叠、点开展开
7. 桌面 HTML：分段控制器切换生效，且预览模式下右侧无重复编辑按钮
8. `htmlAiWrite` 单测：seed 去首尾空白、写回原样 HTML

---

## 落地状态（2026-09-13）

**已全部落地**，原「待你拍板」清单确认如下：

- 评论：html 开（与 md 同 API）✅
- 帮写：html **开**（原提案为关，后按决策 5 改为开，走 HTML 原文）✅
- 政策表删除 `editor` 列 ✅
- reader 与桌面同组件 ✅
- 文档信息复用 ✅
- 编辑器内嵌 DocChrome ✅
