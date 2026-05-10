# openDocument 竞态条件 BUG 修复记录

## 现象

用户快速连续点击多篇文档切换时，可能出现编辑器显示的内容与 URL 中 `documentId` 不匹配的情况——旧的 API 请求先回来后覆盖了新请求的结果。

## 根因

`App.tsx` 中 `openDocument` 是异步函数，包含多个 `await` 步骤：

```
openDocument(doc1):
  await getDraft(doc1)          ← 耗时 A
  ...
  await getDocumentApi(doc1)    ← 耗时 B
  ...
  setActiveDoc(doc1.content)    ← 最终设置内容
```

如果在步骤 A 或 B 还在进行时，用户又点击了 `doc2`，触发了新的 `openDocument(doc2)`：

```
时间线:
  t0: openDocument(doc1) 开始
  t1: openDocument(doc2) 开始  ← 用户快速切换
  t2: getDocumentApi(doc2) 返回 → setActiveDoc(doc2)
  t3: getDocumentApi(doc1) 晚返回 → setActiveDoc(doc1)  ← 覆盖了正确内容！
```

**后果**：编辑器显示 `doc1` 内容，但 URL 是 `doc2`，状态不一致。

## 修复方案

使用 **ref 标记当前预期的 `documentId`**，在每个异步操作完成后检查是否仍然有效：

```typescript
// App.tsx 顶部
const expectedDocIdRef = useRef<string | null>(null);

async function openDocument(docId: string): Promise<void> {
  // 步骤 0：标记当前预期的 documentId
  expectedDocIdRef.current = docId;

  try {
    const draft = await getDraft(docId);
    // 竞态检查：如果用户已经切换到其他文档，当前请求已过时，直接丢弃
    if (expectedDocIdRef.current !== docId) return;

    if (draft && !draft.published && ...) {
      // 本地草稿加载
      setActiveDoc(...);
      return;
    }

    const doc = await getDocumentApi(docId);
    // 再次竞态检查
    if (expectedDocIdRef.current !== docId) return;

    setActiveDoc(draft && !draft.published
      ? { ...doc, content: draft.content, displayName: draft.displayName }
      : doc);
  } catch (err) {
    // 竞态检查：如果已经切换文档，不显示旧请求的错误
    if (expectedDocIdRef.current !== docId) return;
    setAlertMessage(translateError(t, err));
  }
}
```

## 检查点位置

- `getDraft(docId)` 异步返回后
- `getDocumentApi(docId)` 异步返回后
- `catch (err)` 错误处理前

## 涉及文件

- `src/web/app/App.tsx` - 新增 `expectedDocIdRef` 竞态检查

## 经验教训

1. **所有异步 set 操作都需要竞态检查** - 只要有 `await` + 后面跟 `setState`，就应该考虑如果请求期间参数变化了怎么办
2. **用 ref 而不是 state 做标记** - ref 更新不触发重渲染，适合这种"标记预期值"的场景
3. **错误分支也需要检查** - 不仅成功路径需要检查，错误提示也应该做竞态检查，避免旧请求的错误弹到新文档上
