# graph-missing-import-blank-screen-2026-09-13

> 一句话：图谱工具栏重构时用了 `<EllipsisVertical />` 却漏了 import，Vite 编译失败 → React 未挂载 → 图谱页永远停在「加载中...」且**一个请求都不发**。

## 现象

点击进入知识图谱，页面**一直显示「mdocs 加载中...」**，知识图谱界面完全不出现。

关键观察：**浏览器 Network 面板里没有任何请求**（连 `getGraphApi` / `getGraphTaskApi` 都没发）。

## 根因

```ts
// 用了 EllipsisVertical
<EllipsisVertical size={18} strokeWidth={1.75} />

// 但 import 行里没有它
import { X, Loader2, Settings2, ChevronDown, Eye, RefreshCw } from "lucide-react";
```

`tsc` 报 `TS2304: Cannot find name 'EllipsisVertical'`（`GraphPage.tsx(578,16)`）。

**为什么表现为「加载中」而不是报错页**：

1. Vite 编译该模块失败 → 浏览器拿不到可执行的 JS
2. React **从未挂载**，App 的 `phase` 永远停在初值 `"loading"`
3. `phase === "loading"` 时 App 直接 `return <div className="mdocs-loading muted">{t("loading")}</div>` —— **整个 App 只剩这一个 div**
4. 因为是"JS 没跑"而不是"请求失败"，所以**没有任何 network 流量**

## 方案

补 import：

```ts
import { X, Loader2, Settings2, ChevronDown, Eye, RefreshCw, EllipsisVertical } from "lucide-react";
```

顺带清掉同次重构后已无引用的 `Play`（图标语义已由 `RefreshCw` 取代）。

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `src/web/app/GraphPage.tsx` | `EllipsisVertical` | 补 import（手机端三点菜单图标） |
| `src/web/app/GraphPage.tsx` | `Play` | 删无用 import |

## 验证

- `npx tsc -p tsconfig.web.json --noEmit` 对 `GraphPage.tsx` 无输出
- `npx vite build` 成功
- 浏览器进图谱页：Network 出现 `GET /api/graph/...`，图谱正常渲染

## 可复用模式

### 「无任何 network」⇒ 先怀疑 JS 没跑起来，而不是后端

排查顺序：

1. 看浏览器 Console 有没有 **module load / syntax 类错误**（本 case 是 Vite 的编译错误）
2. 跑 `npx tsc -p tsconfig.web.json --noEmit` 找符号/类型错误
3. 最后才怀疑接口

### 前端改动后必须跑 web typecheck —— 因为构建不会替你兜底

`pnpm build` = `build:web`（**`vite build`，不做类型检查**）+ `build:server`（`tsc`）。所以：

- 服务端类型错误 → 构建会拦
- **前端类型错误 → 构建放过，直接进产物**

且 `vitest` 只覆盖有单测的文件，`GraphPage.tsx` 这类无单测组件完全不设防。

**结论**：改前端（尤其 `.tsx`）后，提交前固定执行

```bash
npx tsc -p tsconfig.web.json --noEmit
```

### 已知背景：web typecheck 当前并非全绿

`tsconfig.web.json` 下仍有**历史遗留**错误（`merge/merge-plan.ts`、`DocumentEditor.tsx` 的 slash options、`DomainManagementPanel.tsx`、i18n locale key 等，约 14 条），本次未修。所以该命令**不能只看退出码**，要 `grep` 自己改过的文件：

```bash
npx tsc -p tsconfig.web.json --noEmit 2>&1 | grep -E "GraphPage|DocChrome"
```

## 同日相关（非本记录主题）

同批图谱工具栏改动还引入过一个 **CSS 作用域**问题：`.graph-desktop-actions` 只写了"桌面端显示"、漏了"手机端隐藏"，导致手机端三点菜单与它收纳的按钮**同时出现**。修法与显隐成对约定见 [`requirements/ui-visual-system/设计契约.md`](../requirements/ui-visual-system/设计契约.md) 与 [`requirements/knowledge-graph/设计契约.md`](../requirements/knowledge-graph/设计契约.md)。
