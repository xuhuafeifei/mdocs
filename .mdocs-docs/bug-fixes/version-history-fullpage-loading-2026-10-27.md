# 版本历史点击偶发整页「加载中...」

**日期**：2026-10-27

## 现象

打开文章版本历史，点击列表项（尤其往下点）时，偶发整页进入 mdocs「加载中...」。

## 原因

1. **路由重挂**：`Router` 里 `/` 与 `/doc/:documentId` 各挂一份 `<App />`。任意导致路由身份切换的导航会卸载重挂 App → `phase` 初始值 `loading` → 整页加载中。预览区 Lobe `Editor` 若抛错拖垮树，也可能表现为需刷新后的加载态。
2. **预览加载 UX**：切换 commit 时用整块 `加载中...` 替换预览，易与整页加载混淆；`hideAuto` 曾误触发整表 `load()` 再闪一次 loading。

## 修复

- `Router.tsx`：非 playground 统一 `path="*"` 挂一份 `App`；`App` 用 `useMatch("/doc/:documentId")` 读 id。
- `VersionHistoryPanel`：切换版本保留旧预览 + 角标 busy；`load` 只依赖 `documentId`。
- **后续（3.0.2）**：预览去掉 Lobe Editor，改 `convertContentApi` → `react-markdown`，消除 Lexical #38（empty editor state）。
