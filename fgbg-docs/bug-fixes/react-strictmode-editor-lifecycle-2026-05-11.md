# React StrictMode 下 editor.destroy() 导致 "DataSource not registered" — 修复记录

**本文回答：** 为何修复内存泄漏后出现了 `DataSource for type "json" is not registered` 报错；React StrictMode 如何与 `useEffect` cleanup 交互；以及如何用延迟取消模式兼容 StrictMode。

## 涉及文件

- 上游：`~/github/my-lobe-editor/src/editor-kernel/react/react-editor.tsx`
- 上游：`~/github/my-lobe-editor/src/react/hooks/useEditor.ts`
- mdocs：`src/web/app/DocumentEditor.tsx`
- mdocs：`src/web/app/playground/PlaygroundEditor.tsx`

## 现象

修复内存泄漏后，控制台报错：

```
Uncaught Error: DataSource for type "json" is not registered.
    at _a7.setDocument (chunk-RSPRPUBF.js:20864:15)
    at DocumentEditor.tsx:363:11
```

对应代码：
```tsx
queueMicrotask(() => {
  e.setDocument(contentType, initContent);  // line 363
});
```

## 根因

`main.tsx` 开启了 `React.StrictMode`：

```tsx
<React.StrictMode>
  <App />
</React.StrictMode>
```

React 18 StrictMode 在开发环境下会**故意双重调用 useEffect**：

1. **第一次挂载**：setup 执行 → `onInit(editor)` → `handleInit` 设置内容
2. **模拟卸载**：cleanup 执行 → `editor.destroy()` → 编辑器内部数据源被注销
3. **重新挂载**：setup 再次执行 → `onInit(editor)` → 但 **editor 仍是同一个实例**（useMemo 未重新计算）且 **已被 destroy**
4. `handleInit` 中调用 `editor.setDocument("json", ...)` → 数据源已不存在 → 报错

### 为何 useMemo 不重新计算？

`ReactEditor` 的 `useMemo` 依赖是 `[editorProp]`。StrictMode 不会双重调用 useMemo（依赖未变），所以 `composerContext` 数组和其中的 `editor` 实例都是同一个对象。

## 修复方案

### 核心思路：延迟 destroy + remount 时取消

在 cleanup 中不立即 destroy，而是把 destroy 排队到 `queueMicrotask`。如果紧接着是 StrictMode 的 remount，新的 setup 会同步执行，在 microtask 执行前取消 destroy。

**ReactEditor：**

```tsx
const pendingDestroyRef = useRef<(() => void) | null>(null);

useEffect(() => {
  const editor = composerContext[0];

  // StrictMode remount 时取消待执行的 destroy
  if (pendingDestroyRef.current) {
    pendingDestroyRef.current();
    pendingDestroyRef.current = null;
  }

  if (onInit) onInit(editor);

  return () => {
    // 延迟到 microtask 执行，给 StrictMode remount 留出时间
    pendingDestroyRef.current = () => { editor.destroy(); };
    queueMicrotask(() => {
      if (pendingDestroyRef.current) {
        pendingDestroyRef.current();
        pendingDestroyRef.current = null;
      }
    });
  };
}, [composerContext, onInit]);
```

**useEditor hook：** 同样模式。

### StrictMode 下的执行时序

| 阶段 | pendingDestroyRef | 结果 |
|---|---|---|
| 第一次 setup | `null` | 正常初始化 |
| 模拟卸载 cleanup | 设为 destroy 函数，排队 microtask | — |
| 第二次 setup | 调用并清空 ref | **取消 destroy** |
| microtask 执行 | `null` | **不执行 destroy** |
| 真正卸载 cleanup | 设为 destroy 函数，排队 microtask | — |
| 无 remount | — | microtask 执行，**真正 destroy** |

## 检索关键词

`StrictMode` · `useEffect` · `cleanup` · `queueMicrotask` · `DataSource not registered` · `editor.destroy()` · `useMemo` · 双重挂载 · `pendingDestroyRef`

## 经验

1. **在 StrictMode 下，useEffect cleanup 中销毁资源要格外小心**：useMemo/useRef 不会随 StrictMode 重新计算，导致同一个实例被 destroy 后继续使用。
2. **延迟执行 + 取消令牌是兼容 StrictMode 的标准模式**：适用于任何需要在 cleanup 中释放不可再生资源的场景。
3. **不要同时在父组件和子组件中对同一实例调用 destroy**：DocumentEditor 曾增加防御性 `editorRef.current.destroy()`，与 ReactEditor 的 cleanup 冲突，已移除。
