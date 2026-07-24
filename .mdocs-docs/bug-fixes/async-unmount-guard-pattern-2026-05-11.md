# 异步请求组件卸载保护 — 批量修复记录

**本文回答：** 哪些组件的异步请求在卸载后仍调用 `setState`；为何这会导致内存泄漏和异常；以及 `mountedRef` / `expectedDocIdRef` 两种保护模式的用法。

## 涉及文件

- `src/web/app/CommentsPanel.tsx`
- `src/web/app/SettingsPage.tsx`
- `src/web/app/DraftListPage.tsx`
- `src/web/app/RecoveryDialog.tsx`
- `src/web/app/DocumentEditor.tsx`

## 现象

组件卸载后，旧的异步请求（fetch / IndexedDB）返回结果，仍对已卸载组件调用 `setState`。React 18+ 会静默忽略，但在 React 17 及以下会报 warning；更严重的是，如果 closure 捕获了大对象，会延长 GC 周期。

## 根因

大量异步操作缺少 `mounted` / `cancelled` guard：

| 组件 | 异步操作 | 后果 |
|---|---|---|
| `CommentsPanel` | `fetchCommentsApi` | 快速展开/收起评论面板时，旧请求 setState |
| `SettingsPage` | `listCliTokensApi` / `fetchBookmarksApi` / `fetchMyDocumentsApi` / `listAllDrafts` | 切换 Tab 或返回 docs 视图时 setState |
| `DraftListPage` | `listAllDrafts` | 关闭抽屉后 setState |
| `RecoveryDialog` | `fetchDomainsSafe` / `fetchTreeApi` | 关闭弹窗后 setState |
| `DocumentEditor` | `fetchVisitorsDirectoryApi` | 切换文档后 setState |

## 修复方案

### 模式 A：mountedRef（适用于组件级保护）

```tsx
const mountedRef = useRef(true);

useEffect(() => {
  mountedRef.current = true;
  return () => { mountedRef.current = false; };
}, []);

async function loadData() {
  try {
    setLoading(true);
    const result = await fetchData();
    if (!mountedRef.current) return;  // ← 卸载后丢弃
    setData(result);
  } catch {
    // ignore
  } finally {
    if (mountedRef.current) setLoading(false);
  }
}
```

**应用于：** SettingsPage、DraftListPage、RecoveryDialog、DocumentEditor（fetchVisitorsDirectoryApi）

### 模式 B：expectedDocumentIdRef（适用于文档/ID 级竞态保护）

```tsx
const expectedDocumentIdRef = useRef(documentId);

useEffect(() => {
  expectedDocumentIdRef.current = documentId;
  loadComments();
}, [documentId]);

async function loadComments() {
  const currentDocId = expectedDocumentIdRef.current;
  setLoading(true);
  try {
    const res = await fetchCommentsApi(documentId);
    if (expectedDocumentIdRef.current !== currentDocId) return;  // ← ID 已变，丢弃
    setComments(res.comments);
  } finally {
    if (expectedDocumentIdRef.current === currentDocId) {
      setLoading(false);
    }
  }
}
```

**应用于：** CommentsPanel（快速切换文档时丢弃旧评论请求）

### DraftListPage 额外修复：Toast timer unmount cleanup

```tsx
useEffect(() => {
  // ...
  return () => {
    mountedRef.current = false;
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };
}, []);
```

## 检索关键词

`mountedRef` · `expectedDocIdRef` · `cancelled` · `async setState` · `useEffect cleanup` · 竞态保护 · 组件卸载 · `fetchCommentsApi` · `listAllDrafts`

## 经验

1. **所有 async → setState 的路径都应检查 mounted**：尤其在 drawer、dialog、panel 等可频繁打开/关闭的组件中。
2. **Tab 切换不等于组件卸载**：SettingsPage 的 Tab 切换在组件内部，但返回 docs 视图会导致 SettingsPage 卸载，所以仍需要 mounted guard。
3. **`finally` 中的 setState 也要保护**：`setLoading(false)` 容易被忽略。
