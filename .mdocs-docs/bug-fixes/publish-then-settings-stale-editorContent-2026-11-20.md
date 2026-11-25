# publish 后进设置再回来正文回退 — 2026-11-20

## 现象

修改文章并发布成功后，进入设置再返回文档，正文变成**发布前**的旧内容。

## 根因

`finalizeAfterPublish` 为避免视口跳动：当服务端正文已等于刚发布内容时**不 bump `contentRevision`**，且原先也不更新 `editorContent.content`（依赖仍挂载的 live Editor DOM）。

`DocumentEditor` 的 `setDocument` effect 只依赖 `documentId` / `contentRevision`，不依赖 `initialContent`——所以发布当下看起来正常。

但 `view === "settings"` 会卸载整棵文档壳；返回时用过期的 `editorContent` 重挂，就喂回发布前的 React 态。`onContentChange` 相对 live 编辑器常有滞后，更容易踩中。

## 方案

发布成功且可跳过 bump 时，仍把 `editorContent`（及分屏 secondary）**同步为 GET 到的 `doc.content`**，不 bump revision。live 实例不重载；卸载再挂载用的是已发布正文。

## 定位

| 路径 | 符号 |
|------|------|
| `src/web/app/App.tsx` | `finalizeAfterPublish` |
| `src/web/app/DocumentEditor.tsx` | `setDocument` effect（deps 无 `editorSafeContent`） |
