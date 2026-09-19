# requirements

已落地功能契约（自 `fgbg-docs` **直接搬入**）。状态一律视为 **已同意（历史）**。本期未强制拆满「需求分析 / 设计契约 / 代码索引」三件套。

进行中的新需求单独标注。

| 夹 | 入口 |
|----|------|
| [workspace-wording-start-writing](./workspace-wording-start-writing/设计契约.md) | **已同意**：对人叫工作空间，实现仍叫 domain；空态「开始写作」+「AI 帮写」 |
| [conflict-force-overwrite](./conflict-force-overwrite/需求分析.md) | **已同意**：冲突时 owner 强制覆盖（假 merge，正文=本地） |
| [android-webview-shell](./android-webview-shell/设计契约.md) | **已同意**：Android 侧载 APK，用户自填 mdocs 地址 |
| [desktop-webview-shell](./desktop-webview-shell/设计契约.md) | **已同意**：Tauri 2 桌面壳（Mac + Windows），用户自填 mdocs 地址 |
| [html-documents](./html-documents/设计契约.md) | **一期已落地**；**二期已落地** [DocChrome](./html-documents/设计契约-doc-chrome.md)（含手机端折叠、默认预览、分段控制器） |
| [ui-visual-system](./ui-visual-system/设计契约.md) | **已同意**：选中态 / 层级 / 控件声量；弹框 `z-index: 200` |
| [login-register-dialog](./login-register-dialog/设计契约.md) | **已同意**：去 Tab，登录优先；⚠️ 含 1 处遗留待拍板 |
| [graph-cache-dirty](./graph-cache-dirty/设计契约.md) | **已同意**：图谱 dirty / 缓存 |
| [agent-provider-config](./agent-provider-config/设计契约.md) | **已同意**：LLM 两条配置线（DeepSeek / 自定义 + providerId） |
| [user-agent-skills](./user-agent-skills/需求分析.md) | **已同意**：私人用户 skill + 引用展开 |
| [onboarding-ai](./onboarding-ai/需求分析.md) | **进行中**：上手 Agent（无编写能力） |
| [bookmarks](./bookmarks/设计契约.md) | 文档收藏 |
| [auto-save-draft](./auto-save-draft/设计契约.md) | 自动保存草稿 |
| [recovery-code](./recovery-code/设计契约.md) | 恢复码 |
| [draft-copy-preview](./draft-copy-preview/设计契约.md) | 草稿副本与预览 |
| [draft-publish-recovery](./draft-publish-recovery/设计契约.md) | 发布失败恢复 |
| [comments-panel](./comments-panel/) | layout + resize 两篇 |
| [doc-info-menu](./doc-info-menu/设计契约.md) | 文档信息菜单 |
| [editor-content-width](./editor-content-width/设计契约.md) | 编辑区宽度 |
