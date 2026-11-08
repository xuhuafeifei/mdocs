# 多段引用导出 MD 后「> 后面内容像被清空」

**日期**：2026-11-08

## 现象

文档里已有 blockquote（多段或软换行多行）。再插入带 `>` 的文本后，Lobe `getDocument('markdown')` 往返，已有引用里除第一行外的正文掉出引用或看起来被清空。

## 原因

`registerMarkdownWriter('quote')` 使用 `ctx.wrap('> ', breakMark)`，只给整段序列化结果的**开头**加一次 `>`。多 `paragraph` 子节点时中间会插 `\n\n`，后续行不再带 `>`；经 `remark` format 后变成普通段落。草稿/对比又以 markdown 为基线，往返后引用块只剩第一行。

软换行（`linebreak` → 单 `\n`）碰巧仍在同一 blockquote 里，所以单段软换行没事，多段 paragraph 会炸。

## 方案

quote writer 改为 `addProcessor`：对 children 序列化结果**逐行**加 `>` / 空行加 `>`（与服务端 `lexical-to-markdown` 的 quote 分支一致）。

## 定位

| 路径 | 符号 |
|------|------|
| `my-lobe-editor/src/plugins/common/plugin/index.ts` | quote `registerMarkdownWriter` |
| `my-lobe-editor/src/plugins/common/plugin/__test__/quote-md-repro.test.ts` | 回归 |
| `mdocs/src/server/documents/lexical-to-markdown.ts` | 服务端对照实现 |
