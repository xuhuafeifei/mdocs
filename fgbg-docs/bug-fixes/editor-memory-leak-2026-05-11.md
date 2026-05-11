# Lexical 编辑器实例内存泄漏 — 修复记录

**本文回答：** 为何切换文档时内存飙升到 40GB；`@lobehub/editor` 的 `ReactEditor` 为何泄漏；以及在上游和 mdocs 侧分别如何修复。

## 涉及文件

- 上游：`~/github/my-lobe-editor/src/editor-kernel/react/react-editor.tsx`
- 上游：`~/github/my-lobe-editor/src/react/hooks/useEditor.ts`
- mdocs：`src/web/app/DocumentEditor.tsx`
- mdocs：`src/web/app/App.tsx`

## 现象

窗口打开后内存飙升到 **40GB**。频繁切换文档时内存线性增长，浏览器标签页崩溃。

## 根因

### 1. ReactEditor 创建实例后从不销毁

`@lobehub/editor` 的 `ReactEditor` 组件源码：

```tsx
const ReactEditor = ({ editor: editorProp, children, config, onInit }) => {
  const composerContext = useMemo(() => {
    return [editorProp || Editor.createEditor(), createLexicalComposerContext(null, null)];
  }, [editorProp]);

  useEffect(() => {
    const editor = composerContext[0];
    if (onInit) onInit(editor);
    // ❌ 没有 cleanup，组件卸载时不调用 editor.destroy()
  }, [composerContext, onInit]);
};
```

当不传入 `editor` prop 时（mdocs 的使用方式），每次挂载都会 `Editor.createEditor()`，但卸载时**永不销毁**。

### 2. 双重 key 强制重新挂载，加剧泄漏

`App.tsx:844`：
```tsx
<DocumentEditor key={activeDoc.documentId} ... />
```

`DocumentEditor.tsx:954`（已移除）：
```tsx
<Editor key={props.document.documentId} ... />
```

每次切换文档，两层组件树被完全卸载+重建。由于 ReactEditor 不 destroy，**旧编辑器实例完整地泄漏在内存中**。

### 3. DecoratorNodes 持有极重的资源

每个泄漏的编辑器实例内部包含：

| Node/Plugin | 泄漏资源 |
|---|---|
| `CodeMirrorNode` | 每个代码块一个完整的 **CodeMirror 实例** |
| `Meta2dNode` | **meta2d canvas 引擎**（可能含 WebGL 上下文） |
| `ImageNode` / `BlockImageNode` | 图片数据、blob URL |
| `FileNode` | 文件元数据、上传状态 |
| `MathBlockNode` | KaTeX 渲染资源 |

若文档包含大量图片/代码块/图表，单个实例可达数百 MB。频繁切换时线性累积，轻松达到 40GB。

## 修复方案

### 上游根治（my-lobe-editor）

`react-editor.tsx` 的 `useEffect` 增加 cleanup：

```tsx
useEffect(() => {
  const editor = composerContext[0];
  if (onInit) onInit(editor);

  return () => {
    editor.destroy();
  };
}, [composerContext, onInit]);
```

`useEditor.ts` hook 同样增加 cleanup destroy。

### mdocs 侧防御性兜底

`DocumentEditor.tsx` 通过 `editorRef` 捕获实例，在卸载时强制 destroy（作为上游未修复时的兜底）。**已在上游修复后移除该兜底**，避免与 ReactEditor 的 cleanup 冲突。

```tsx
// 已移除：避免 StrictMode 下重复 destroy
// useEffect(() => {
//   return () => { editorRef.current?.destroy(); };
// }, []);
```

同时**移除了 `<Editor>` 上多余的 `key={props.document.documentId}`**（`App.tsx` 的 `key={activeDoc.documentId}` 已足够强制重新挂载）。

## 检索关键词

`editor.destroy()` · `ReactEditor` · `useEditor()` · `Editor.createEditor()` · `LexicalComposerContext` · `key={documentId}` · 内存泄漏 · 40GB · 切换文档

## 经验

1. **第三方 React 组件若创建重量级资源，必须验证其 cleanup**：不能假设上游组件会正确销毁。
2. **key 强制重新挂载是双刃剑**：虽然能避免状态混淆，但每次卸载若资源未清理，泄漏会被放大。
3. **DecoratorNode 是内存大户**：CodeMirror、Canvas 引擎、图片数据等嵌在编辑器内部时，单个实例就可能占用数百 MB。
