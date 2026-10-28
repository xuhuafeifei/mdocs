# 015 — overwrite_all Diff 相等：放宽比较，不强制同源 JSON

- **状态**：accepted（2026-10-28）
- **上下文**：`overwriteAll` 一边是编辑器 `toJSON()`，一边是 MD 再解析。严格 JSON 相等会把未改段落打成假 Diff。
- **决策**：保持双源；比较时 canonicalize 忽略 ephemeral，并以「同块类型 + 可见纯文本」为 equal 兜底。不改为「两边都先 MD 再 parse」或「Agent 只交 Lexical JSON」。
- **后果**：
  - 假 Diff 大幅减少；纯格式变更（仅加粗等）可能被当成 equal 略过（DiffChrome 本就只展示旧行纯文本）。
  - 回归测必须用「编辑器形态 JSON vs `parseMarkdownToLexical(md)`」，不能两边都手搓同构 fixture。
- **依据**：[`../bug-fixes/overwrite-all-false-diff-hunks-2026-10-28.md`](../bug-fixes/overwrite-all-false-diff-hunks-2026-10-28.md)
