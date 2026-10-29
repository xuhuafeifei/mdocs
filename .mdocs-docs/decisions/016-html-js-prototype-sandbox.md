# 016 — HTML 文档允许内联脚本（沙箱 + 严格 CSP）

- **状态**：accepted（2026-10-29）
- **上下文**：HTML 文档最初以 `sandbox=""`（最严沙箱，禁 JS）上线，用于静态看板 / Demo 页。但要"可交互的原型图"（点标签切页、步骤向导、表单校验演示）就必须执行内联脚本。mdocs 的信任模型是：单进程、无账户、访客即身份、cookie 即权限，文档正文（含访客邀请 / 分享 / Agent 代写）默认是不可信输入。
- **选项**：
  1. **继续全禁**：只能做 CSS 交互（`:target` / checkbox hack / `<details>`），做不了状态机。
  2. **只给 `allow-scripts` + 严格 CSP**：脚本可跑，但 origin 为 opaque（读不到 cookie/parent/localStorage），网络被 CSP 掐断。
  3. **独立 origin 托管**：完整能力，但要子域/CORS/Cookie 域，部署复杂度高。
- **决策**：采用 **2**。
  - `sandbox` 固定为 `allow-scripts`，**任何情况下不得追加 `allow-same-origin`**（两者同时出现时 iframe 可自摘沙箱、读写 parent、用 cookie 调 /api，防护归零）。
  - CSP 从 `default-src 'none'` 起步，只放行：`script-src 'unsafe-inline'`、`style-src 'unsafe-inline'`、`img-src data: blob: <assetOrigin>`、`font-src data:`、`media-src data: blob: <assetOrigin>`；`form-action 'none'`、`base-uri 'none'`。
  - `<assetOrigin>` = 运行期 `window.location.origin`。沙箱 iframe 是 opaque origin，`'self'` 永不匹配，必须写绝对 origin；这样 `/api/assets/<id>` 可直接引用（该路由挂在鉴权中间件之前，公开只读，不需要 cookie）。`<img>` 属 no-cors 请求，无需 CORS 头即可显示。
  - **版本历史 / 只读预览不执行脚本**（`sandbox=""` + `script-src 'none'`），历史 blob 不应有机会跑代码。
- **后果**：
  - ✅ 可做纯前端交互原型：内联脚本、DOM 状态、CSS 动画、canvas、base64 图片。
  - ❌ 无 fetch/XHR/WebSocket（脚本里仍拿不到响应）；无**第三方**图片 / CDN / 字体；无 localStorage/cookie/IndexedDB；`history.pushState` 抛错（单页路由用 hash 或纯状态）；表单不可提交；只能单文件（`srcDoc` 没有同源样式/脚本资源，但站内 `/api/assets` 图片可用）。
  - 🖼 图片两条路：`data:` 内联（base64/SVG，适合小图、贴图即用），或 `/api/assets/<id>`（站内已上传资源，不占 HTML 体积；不能读像素——跨源无 CORS，canvas 会被 taint）。
  - ⚠️ 剩余风险：死循环卡渲染线程（沙箱管不了）、iframe 内视觉钓鱼。缓解：带脚本文档暂不对外分享；若要开放，按域/按分享链路降级为 `script-src 'none'`。
- **落点**：
  | 位置 | 说明 |
  |------|------|
  | `src/web/app/html-preview.ts` | sandbox / CSP 的单一事实来源 `buildHtmlPreviewDocument` `htmlPreviewSandbox` |
  | `src/web/app/html-preview.test.ts` | 断言 sandbox 永不含 `allow-same-origin`、CSP 指令集 |
  | `src/web/app/HtmlEditor.tsx` | 编辑器预览启用脚本 + 顶部提示 |
  | `src/web/app/VersionHistoryPanel.tsx` | 版本预览保持不执行脚本 |
  | `src/server/cli/asset-upload.ts` | `mdocs asset upload <file...>`：本地文件落 assets，输出 `/api/assets/<uuid>.<ext>`，供原型直接引用 |
- **回退**：把 `HtmlEditor` 的 `allowScripts` 改回 `false` 即可恢复全禁，其余代码无需改动。
