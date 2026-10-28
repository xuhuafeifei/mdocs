# Vite 依赖预构建漏项 → 整页白屏 / 永远「mdocs 加载中」

> 一句话：`optimizeDeps.exclude` 掉 mermaid 后，它的 CJS 依赖 `@braintree/sanitize-url` 被裸发给浏览器，ESM 解析 CJS → 命名导出不存在 → React 从未挂载，只剩 index.html 里那个 CSS 占位字。

## 现象

- 打开 `http://localhost:5173/#/doc/<id>`（任意文档，甚至首页）长时间停在「mdocs 加载中…」，无限转；`#root` 里 `childElementCount === 0`。
- 页面没有 Vite 错误浮层、没有 React 错误边界提示，看起来像"加载慢/接口卡住"，实际上一个网络请求都没在等。
- 时好时坏：改过 `vite.config.ts` 后依赖缓存半新半旧，重优化过程中偶发一次正常渲染，很容易误判成"只是慢"。

## 根因

1. **占位字来自 CSS，不是 React**：`src/web/index.html` 里 `#root:empty::before { content: "mdocs 加载中…" }`。只要 React 没挂载，就永远是这句话——它把"JS 挂了"伪装成"还在加载"。
2. **Vite 依赖预构建漏项**：`vite.config.ts` 的 `optimizeDeps.exclude` 含 `mermaid`（为规避 mermaid 11 预构建后动态 chunk 指到 `.vite/deps/` 假路径 → `Failed to fetch`）。
3. mermaid 被 exclude ⇒ 其模块原样下发。`mermaid/dist/mermaid.core.mjs` 的 `chunks/mermaid.core/*.mjs` 对 **`@braintree/sanitize-url@7.1.2`** 是**裸 import**，而该包是纯 CJS（`package.json` 无 `type`/`module`，产物 `dist/index.js` 走 `exports.sanitizeUrl`）。浏览器把它当 ESM 解析，报：
   `The requested module '.../@braintree/sanitize-url/dist/index.js' does not provide an export named 'sanitizeUrl'`
4. 该 chunk 在首屏链上：`@lobehub/editor/es/style-*.js` 顶部静态 `import mermaid from "mermaid"`（MermaidWithErrorBoundary），编辑器一被加载就整条模块图失败。
5. **为什么之前没炸**：早先的配置把 mermaid 一起预构建；10-27 为修动态 chunk 才加的 `exclude`，同时只补了 `mermaid > dayjs` 的 nested include，漏了 `sanitize-url`。

## 方案

在 `vite.config.ts` 的 `optimizeDeps.include` 里，把 mermaid 的 **CJS 依赖全部 nested include**（与既有 dayjs 同一处理法）：

| include 项 | 何时才会炸 |
|---|---|
| `mermaid > @braintree/sanitize-url` | 首屏（本次） |
| `mermaid > roughjs` | 架构图 / 流程图（rough 风格） |
| `mermaid > d3-sankey` | sankey 图 |
| `mermaid > cytoscape-fcose` | flowchart（fcose 布局） |
| `mermaid > cytoscape-cose-bilkent` | flowchart（cose-bilkent 布局） |

后四个是**同一病灶的潜伏期**：进页面不炸，等用户画到那张图才白屏，排查成本更高。

排查/复现要点：改完 `vite.config.ts` 必须 `rm -rf node_modules/.vite` 再重启（或确认日志出现 `Re-optimizing dependencies`），否则旧缓存会让结论失真。

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `vite.config.ts` | `optimizeDeps.include` / `optimizeDeps.exclude` | 本次修复点 |
| `src/web/index.html` | `#root:empty::before` | 「mdocs 加载中…」占位，诊断误导源 |
| `node_modules/mermaid/dist/mermaid.core.mjs`、`chunks/mermaid.core/*.mjs` | 裸 `import ... from "@braintree/sanitize-url"` | 触发链上游（依赖包内部，不改） |
| `node_modules/@lobehub/editor/es/style-*.js` | `import mermaid from "mermaid"` | 让 mermaid 进入首屏图 |

## 验证

- `rm -rf node_modules/.vite` → 重启 `pnpm dev:web` → 打开 `/#/doc/1ed1ce5a-a2b4-4389-afbd-b0f37cd67361`：`#root` 子节点 1，编辑区 `[contenteditable=true]` ~7.5s 就绪，图片 + Mermaid 块正常。
- 硬刷新（`page.reload`）复测：`editor-ready`，无 `pageerror`。
- `.vite/deps` 出现 `mermaid___@braintree_sanitize-url.js` 即预构建生效。
- 残留 console error 只有 Lobe 编辑器自带的 React 19 噪音（`flushSync was called from inside a lifecycle method`、`Accessing element.ref was removed in React 19`），与本问题无关。

## 可复用模式（已写入 `map/ops.md`）

- **`optimizeDeps.exclude` 一个包 = 手动接管它全部依赖的 interop**。排除后要把它 `package.json` 里 **module 入口实际 import 到的 CJS 包**逐个 nested include；只补跑得起来的那几个，等于给自己埋延迟爆炸的地雷。
- **「永远加载中」优先当"JS 未执行"查**：先看 `#root` 子节点数、`pageerror`、`document.querySelector('vite-error-overlay')`，不要先怀疑接口/慢查询。
- 判断某依赖是否会被裸发：看它 `package.json` 有无 `type: module` / `module` 字段；只有 CJS 且不在 `.vite/deps` 里，才会命中 `does not provide an export named`。
