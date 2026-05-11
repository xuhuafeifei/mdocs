# 浏览器资源泄漏清理 — 修复记录

**本文回答：** 哪些浏览器侧资源（ObjectURL、DOM 节点、debounce 定时器、全局 window 引用）存在泄漏；以及如何在组件卸载或事件回调中正确清理。

## 涉及文件

- `src/web/app/playground/PlaygroundEditor.tsx`
- `src/web/app/actions.ts`

## 现象

1. Playground 页面上传文件后内存持续增长
2. 取消文件选择对话框后 DOM 节点未移除
3. Playground 卸载后 `window.editor` 仍指向旧实例
4. debounce 定时器在组件卸载后继续持有 closure

## 根因与修复

### 1. ObjectURL 泄漏（PlaygroundEditor）

**问题：** `URL.createObjectURL(file)` 创建后从未 `revokeObjectURL()`。

```tsx
// 修复前
resolve({ url: URL.createObjectURL(file) });

// 修复后
const url = URL.createObjectURL(file);
objectUrlsRef.current.push(url);
resolve({ url });
```

**卸载时统一释放：**
```tsx
useEffect(() => {
  return () => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
  };
}, []);
```

### 2. 文件选择器 DOM 泄漏（actions.ts）

**问题：** `input.oncancel` 不是标准事件，Safari/Firefox 不支持。用户取消选择后节点永不移除。

```ts
// 修复前
input.onchange = () => { input.remove(); };
input.oncancel = () => { input.remove(); };  // Safari 不触发

// 修复后：增加 5s 兜底超时
const cleanupTimeout = setTimeout(() => input.remove(), 5000);

input.onchange = (event) => {
  clearTimeout(cleanupTimeout);
  // ... handle files
  input.remove();
};

input.oncancel = () => {
  clearTimeout(cleanupTimeout);
  input.remove();
};
```

### 3. 全局 window 引用泄漏（PlaygroundEditor）

**问题：** `window.editor = e` 和 `window.__scrollIntoView = scrollIntoView` 在组件卸载后仍指向旧对象。

```tsx
useEffect(() => {
  return () => {
    delete (window as any).editor;
    delete (window as any).__scrollIntoView;
  };
}, []);
```

### 4. debounce 定时器泄漏（PlaygroundEditor）

**问题：** debounce 闭包中的 `timeout` 变量在组件卸载时无法访问，待执行的回调会持有 closure 中的 editor 实例和 JSON content。

```ts
// 修复前：无 cancel 方法
function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => { ... };
}

// 修复后：暴露 cancel
function debounce<A extends unknown[]>(...): ((...args: A) => void) & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => { ... };
  debounced.cancel = () => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
      timeout = undefined;
    }
  };
  return debounced;
}
```

**卸载时调用 cancel：**
```tsx
useEffect(() => {
  return () => {
    handleChange.cancel();
    handleJSONChange.cancel();
  };
}, [handleChange, handleJSONChange]);
```

## 检索关键词

`URL.createObjectURL` · `URL.revokeObjectURL` · `input.oncancel` · `setTimeout` 兜底 · `window.editor` · `debounce.cancel()` · `clearTimeout` · Playground · 文件上传

## 经验

1. **ObjectURL 必须成对 create/revoke**：浏览器不会自动回收，泄漏速度和文件大小成正比。
2. **浏览器兼容性差的事件要用 timeout 兜底**：`oncancel` 在 Safari 中不触发是已知坑。
3. **调试用的全局挂载要清理**：`window.xxx = ...` 在开发时方便，但会成为泄漏源。
4. **debounce/throttle 要暴露 cancel**：否则组件卸载时无法清理待执行的回调。
