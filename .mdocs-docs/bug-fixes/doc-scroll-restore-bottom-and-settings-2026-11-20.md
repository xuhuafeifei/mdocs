# 打开文档默认置底 / 进出设置丢失滚动位置 — 2026-11-20

## 现象

1. 进入某篇文章时，视口经常直接在底部。
2. 滚到中间后进设置再返回，滚动进度不恢复（或又掉到底）。

## 根因

`useDocScrollCache` 本会对抗 Lexical 自动置底，但：

1. **无缓存时不恢复** → Lexical 置底无人拉回。
2. **`pointerdown` 当作用户手势** → 点击聚焦时若已被拽到底，立刻结束对抗并把底部写入 LRU。
3. **恢复窗（4s）结束后仍把自动滚动写入缓存** → 晚期置底污染下次打开 / 设置往返。

进出设置会卸载 `DocumentEditor`；若缓存已被写成底部，返回只能「正确」恢复到底。

## 方案

- 无缓存时目标改为 **顶部**，同样进入对抗窗。
- 仅 **wheel / touchstart** 视为用户手势；去掉 pointerdown。
- 用户手势前：**不**把自动滚动写入 `lastPos` / 缓存；持续拉回目标（最长 ~12s 安全阀）。
- 卸载时若 `lastPos` 仍为 0 但 host 仍有真实 `scrollTop`，补一次落盘。

## 定位

| 路径 | 符号 |
|------|------|
| `src/web/app/hooks/useDocScrollCache.ts` | `useDocScrollCache` |
| `src/web/storage/docScrollCache.ts` | 进程内 LRU |
