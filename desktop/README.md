# mdocs 桌面壳

轻量 WebView：填自己的 mdocs 地址。不上架。不参与 `pnpm build` / npm 包。

一套源码：**macOS（WKWebView）+ Windows（WebView2）**。

## 环境

- **Rust**：`rustup`，建议 `--profile minimal`（不要装 rust-docs）。新开终端若找不到 `cargo`，先 `source "$HOME/.cargo/env"`
- **Node**：已有即可；本目录单独 `npm install`，不碰仓库根 `pnpm-lock.yaml`
- macOS：已有 Command Line Tools 即可，不必装完整 Xcode
- Windows：MSVC 构建工具 + 系统 **WebView2**（Win10/11 通常已带；没有则装 [Evergreen 运行时](https://developer.microsoft.com/microsoft-edge/webview2/)）

本机磁盘紧时不要再装 Visual Studio 全家桶 / Android 模拟器。

## 构建

在 **本目录**（`desktop/`）：

```bash
npm install
# macOS 只打 .app（Windows 安装包须在 Windows 上编）
npx tauri build --bundles app
```

### macOS

产物大致在：

`src-tauri/target/release/bundle/macos/mdocs.app`  
以及 `.../bundle/dmg/mdocs_*.dmg`（若启用 dmg）

把 `.app` 拖到「应用程序」即可。首次可能提示未签名，需在「系统设置 → 隐私与安全性」允许。

### Windows

在 **Windows 电脑**上执行同样的 `npm run tauri build`（不能从 Mac 交叉编译 WebView2 安装包）。

产物大致在：

`src-tauri/target/release/bundle/nsis/mdocs_*-setup.exe`

## 使用

1. 电脑要能访问那台 mdocs。不要在另一台机器上填 `127.0.0.1`（那是「这台电脑自己」）。
2. 打开应用 → 填写例如 `192.168.1.8:4000` 或 `https://你的域名`
3. 刷新 / 更换服务器：菜单「刷新」「更换服务器」
4. 复制了本站文档链接（`/#/doc/<id>`）再切回窗口，会打开该文

## 和主工程的关系

| | |
|--|--|
| 改这里 | 只影响桌面壳 |
| `pnpm build` / `@fgbg/mdocs` | **不受影响**（npm `files` 不含 `desktop/`） |
