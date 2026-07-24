# DocumentEditor handleInit 重复 JSON 解析优化记录

## 现象

`DocumentEditor.tsx` 中存在两处完全相同的 JSON 解析逻辑，用来判断内容是 Lexical JSON 还是 Markdown。

## 根因

### 第一处：useMemo 预计算

```typescript
const contentType = useMemo<"json" | "markdown">(() => {
  if (!props.document.content) return "json";
  try {
    const p = JSON.parse(props.document.content);
    return p?.root?.children ? "json" : "markdown";
  } catch {
    return "markdown";
  }
}, [props.document.content]);
```

**位置**：组件初始化阶段，`contentType` 变量用来传给 `<Editor>` 组件的 `type` prop。

### 第二处：handleInit 回调中的重复解析

```typescript
const handleInit = useCallback((e: IEditor) => {
  setEditor(e);
  const initContent = contentRef.current;
  if (initContent) {
    let ct: "json" | "markdown" = "markdown";
    try {
      const p = JSON.parse(initContent);  // ← 又一次 JSON.parse
      ct = p?.root?.children ? "json" : "markdown";
    } catch {
      ct = "markdown";
    }
    queueMicrotask(() => {
      e.setDocument(ct, initContent);
    });
  }
}, []);  // ← 注意：依赖数组为空，没有用到 contentType！
```

**问题**：
1. 两处代码逻辑完全相同，但因为 `handleInit` 是 `useCallback([])`，不能直接使用 `contentType`（闭包捕获问题）
2. 结果：每初始化一次编辑器，就会做两次完全相同的 `JSON.parse`

## 修复方案

将 `contentType` 加入 `handleInit` 的依赖数组，内部直接使用：

```typescript
const handleInit = useCallback((e: IEditor) => {
  setEditor(e);
  const initContent = contentRef.current;
  if (initContent) {
    // 直接使用已预计算的 contentType，避免重复 JSON.parse
    queueMicrotask(() => {
      e.setDocument(contentType, initContent);
    });
  }
  console.log(...);
}, [contentType]);  // ← contentType 加入依赖
```

### 为什么这样是安全的？

- `contentType` 只依赖 `props.document.content`
- 切换文档时 `props.document.content` 变化 → `contentType` 变化 → `handleInit` 重新创建
- 这与"切换文档时编辑器重新挂载"的行为一致——切换文档后 Editor 组件会重新 mount，`handleInit` 也会重新绑定

## 涉及文件

- `src/web/app/DocumentEditor.tsx` - 移除 `handleInit` 内重复的 JSON.parse

## 经验教训

1. **注意 `useCallback` 闭包陷阱** - 当你发现需要在 callback 内部重复计算某个已经计算过的值时，通常说明依赖数组设计有问题
2. **计算结果应该复用** - 已经用 `useMemo` 计算过的结果不应该再手动重算一遍
3. **依赖数组不一定越少越好** - 空依赖数组看起来简单，但可能导致内部需要重复计算
