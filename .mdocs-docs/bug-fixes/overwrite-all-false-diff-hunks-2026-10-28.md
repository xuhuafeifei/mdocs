# overwrite_all 假 Diff / 红绿贴紧

> 一句话：整篇 Diff 把「没改的段落」也标成红绿；同 hunk 内红绿露白缝；比较策略选「放宽相等」而非强制同源 JSON。

## 现象

- Agent `overwrite_all` 后，肉眼未改的段落也成对出现红删 + 绿增。
- update hunk 内旧行（chrome）与新块之间有白缝；不同 hunk 若全部 `margin:0` 又会糊成一片。
- DiffChrome 用纯文本画旧行，标题旧行看起来「变小」，易误判成类型变了。

## 根因

1. **双源 JSON**：`overwriteAll` 旧边 = `editor.getEditorState().toJSON()`，新边 = Agent MD → `parseMarkdownToLexical`。同文案在 `indent` / `direction` / text 拆分等字段上不一致 → `nodesEqual` 失败 → 整块 `modify`。
2. **delete/insert 配对**：标题等类型变化会把后续块挤进 delete/insert 流；配对成 `modify` 时未再跑 equal。
3. **样式**：`.mdocs-editor p|h*` 的物理 `margin-top/bottom` 压不过仅设 `margin-block` 的规则 → update 内露白缝。

## 方案

- **比较**：canonicalize 忽略 ephemeral；兜底「同块类型 + 可见纯文本相同 → equal」。不强制两边同源 JSON（代价：纯格式变更可能被略过）。
- **配对**：delete+insert 合成 modify 前再 `nodesEqual`，同文则 equal。
- **样式**：update 内 flex + 物理 margin 清零贴紧；hunk 之间保留约 `0.55em`。
- **测试**：编辑器形态 JSON vs `parseMarkdownToLexical(md)` 做 diff，断言截图场景只剩末段一个 hunk（`src/renderer/diff/compute.test.ts`）。
- **依赖**：`@fgbg/lobe-editor` → `1.0.0-fork.35`。

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `my-lobe-editor/src/renderer/diff/compute.ts` | `nodesEqual` `plainTextOf` `computeLexicalDiffRows` | 相等与配对 |
| `my-lobe-editor/src/renderer/diff/compute.test.ts` | editor JSON vs MD JSON | 回归 |
| `my-lobe-editor/src/plugins/diff/react/style.ts` | `diffHunkTheme` | 贴紧 / hunk 间距 |
| `my-lobe-editor/src/plugins/diff/api.ts` | `overwriteAll` | 双源入口 |
| `src/web/app/App.css` | `[data-diff-kind] > *` | 物理 margin 兜底 |
| `vite.config.ts` | `optimizeDeps` | mermaid exclude + CJS nested include（另见同日 mermaid bug-fix） |

## 验证

- 单测：标题同型 + 只改末段 → `['equal','equal','equal','modify']`。
- 手工：`overwrite_all` 后未改段落无红绿；末段有 hunk；同 hunk 红绿贴紧、异 hunk 不粘连。

## 可复用模式

- 已写入 `map/frontend.md`「智能助手按块提案」；决策见 `decisions/015-overwrite-all-diff-equality.md`。
