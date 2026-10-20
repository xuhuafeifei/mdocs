# Merge Lexical→MD 桥缺插件导致远端正文被截断

## 现象

md 冲突合并页「别人的」（绿）只剩标题 + 下一节标题（如 `### Support 组合`），列表/表格及之后全文消失；正文编辑器里看远端仍完整。

## 根因

`LexicalMarkdownBridge` 只挂了 `ReactMarkdownPlugin`。草稿/远端 Lexical JSON 含 `list` / `table` 等节点时，反序列化丢掉后续节点，`getDocument("markdown")` 自然截断。

## 方案

桥接编辑器插件与 `DocumentEditor` 正文节点对齐（List / Table / Link / Code / HR / Math / Meta2d / Markmap 等，不含 Toolbar / File）。导出前双微任务等待 DataSource（同 `handleInit`）。

## 涉及

- `src/web/app/LexicalMarkdownBridge.tsx`
