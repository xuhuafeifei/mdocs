# 012 — 桌面壳用 Tauri 2（macOS + Windows）

- **状态**：accepted
- **上下文**：已有 Android 系统 WebView 壳。桌面也要「填自己的 mdocs 地址 → 固定窗口打开」，且需同时覆盖 Mac 与 Windows。磁盘紧，不能再上一套 Electron Chromium。
- **决策**：`desktop/` 使用 **Tauri 2**，WebView 用系统组件（macOS WKWebView、Windows WebView2）。行为对齐 Android 壳；不把 `src/web` 打进安装包。
- **后果**：
  - 安装包小，但构建需要 Rust；Windows 另需 WebView2。
  - 不能在 Mac 上交叉编译出可靠的 Windows 安装包。
  - 未选 Electron（体积）与纯 Swift（无 Windows）。
