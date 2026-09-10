# 白屏：GraphPage.css 多余 `}` 导致 App 布局高度为 0 — 2026-09-10

## 现象

- DOM/`#root` 有「暂无文档」等文案，画面却接近空白（仅助手 FAB）
- Cursor 内置浏览器窄屏尤其明显
- `.mdocs-layout` / `.mdocs-app-root` **计算高度为 0**

## 根因

`src/web/app/GraphPage.css` 窄屏 `@media` 括号错位：一段本应在 `max-width: 768px` 内的规则落在媒体查询外，末尾多一个 `}`。打包进 `index-*.css` 后，其后的 `.mdocs-app-root { height: 100vh; ... }` 等 App 布局规则未生效，整页高度塌成 0。

## 修复

把窄屏规则收进同一 `@media (max-width: 768px)`，去掉多余 `}`。

## 验证

修后重新 build/部署；DevTools 中 `.mdocs-app-root` 高度应为视口高，空域欢迎页可见。
