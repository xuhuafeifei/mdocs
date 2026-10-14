# 手机文档搜索栏挤没输入、模式用原生 select

> 一句话：窄屏搜索改两行浮层 + MiniSelect；曾误做成全屏已收回。

## 现象

1. 手机搜索顶栏左侧像空框，输入框几乎不可见。
2. 「默认（混合）」弹出系统原生下拉，不是 mdocs UI。
3. 一度改成全屏铺满，观感差。

## 根因

单行 flex 里图标 + 输入 + 两个筛选 + 关闭互相抢宽，`input` `min-width: 0` 被挤没。检索模式用原生 `<select>`。全屏是过度布局。

## 方案

- 查询区 / 筛选区分组；窄屏 grid：上行搜索+关闭，下行模式+工作空间。
- 模式改 `MiniSelect`。
- 保持居中浮层（约 `72vh`），取消全屏 sheet。

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `src/web/app/DocSearchOverlay.tsx` | 搜索 bar | 结构 + MiniSelect |
| `src/web/app/MiniSelect.tsx` | `ariaLabel` `className` | 复用下拉 |
| `src/web/app/App.css` | `.mdocs-doc-search-*` | 窄屏两行浮层 |

## 验证

窄屏打开 ⌘K/侧栏搜索：输入可用；模式为自定义菜单；面板非全屏。
