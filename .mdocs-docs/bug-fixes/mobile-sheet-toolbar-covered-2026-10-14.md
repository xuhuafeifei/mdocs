# 手机 Sheet 加行/加列工具栏被顶栏盖住

> 一句话：窄屏 DocChrome 浮层盖住 sheet 工具栏；吸附顶栏后恢复可见。

## 现象

手机打开 `.sheet` 看不到「加行 / 加列」那一栏。

## 根因

`SheetEditor` 窄屏 `readerChrome` 未传 `readerHeaderDocked`，顶栏用 `position: absolute` 浮在内容上，盖住下方 `.mdocs-sheet-toolbar`。HTML 编辑器已吸附，Sheet 漏了。

## 方案

与 HtmlEditor 一致：`readerHeaderDocked={Boolean(readerChrome)}`；工具栏 `flex-shrink: 0`。

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `src/web/app/SheetEditor.tsx` | `DocChrome` props | 吸附顶栏 |
| `src/web/app/SheetEditor.css` | `.mdocs-sheet-toolbar` | 不被挤出 |

## 验证

窄屏打开可编辑 sheet：顶栏下方可见加行/加列。

## 可复用模式

窄屏 reader 自定义顶栏下若还有第二工具条，默认 **docked**，勿 float 盖住兄弟节点。见 `map/frontend.md`。
