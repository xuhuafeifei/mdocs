# CommentsPanel 评论列表 O(n*m) 性能优化记录

## 现象

`CommentsPanel` 渲染评论列表时，每条评论都需要查找它的回复列表。当评论数量多时，页面会出现明显的性能卡顿。

## 根因

原实现使用 `filter` 在评论列表中反复查找：

```typescript
// 前端分组：根评论
const rootComments = comments.filter((c) => !c.parentId && !c.isDeleted);
// 获取某根评论的所有回复（在 JSX 中对每个根评论调用一次）
const getReplies = (parentId: string) =>
  comments.filter((c) => c.parentId === parentId && !c.isDeleted);
```

渲染时：
```tsx
{rootComments.map((root) => (
  <div key={root.commentId}>
    {/* 根评论头部 */}
    {/* 根评论内容 */}
    {/* 回复列表 - 对每个根评论都遍历一次完整 comments 数组 */}
    {getReplies(root.commentId).length > 0 && (
      <div className="mdocs-comment-replies">
        {getReplies(root.commentId).map((reply) => ...)}
      </div>
    )}
  </div>
))}
```

**时间复杂度**：O(n*m)，其中 n 是根评论数量，m 是总评论数。
- 第一步：`comments.filter()` → O(m)
- 对每个根评论：两次 `comments.filter()` → 2*O(m)
- 总计：O((2n+1)*m) ≈ O(n*m)

当评论数较多时，每次渲染都会造成显著的性能开销。

## 修复方案

**单次遍历 + Map 分组**，时间复杂度从 O(n*m) 优化为 O(n)：

```typescript
const { rootComments, repliesByParentId, totalCount } = useMemo(() => {
  const root: DocumentComment[] = [];
  const replies = new Map<string, DocumentComment[]>();
  let count = 0;

  for (const c of comments) {
    if (c.isDeleted) continue;
    count++;
    if (!c.parentId) {
      root.push(c);
    } else {
      if (!replies.has(c.parentId)) replies.set(c.parentId, []);
      replies.get(c.parentId)!.push(c);
    }
  }
  return { rootComments: root, repliesByParentId: replies, totalCount: count };
}, [comments]);
```

渲染时直接从 Map 读取：
```tsx
{(repliesByParentId.get(root.commentId) ?? []).length > 0 && (
  <div className="mdocs-comment-replies">
    {(repliesByParentId.get(root.commentId) ?? []).map((reply) => ...)}
  </div>
)}
```

**新增的收益**：`totalCount` 在同一次遍历中顺便计算出来，避免了之前：
```typescript
评论 ({comments.filter(c => !c.isDeleted).length})
```
这样的额外 O(m) 开销。

## 涉及文件

- `src/web/app/CommentsPanel.tsx` - 使用 `useMemo` + Map 一次性分组

## 经验教训

1. **列表渲染时注意时间复杂度** - 一旦看到 `list.map(item => list.filter(...)` 就应该警觉，这是典型的 O(n²) 模式
2. **Map/Object 分组是常用优化手段** - 只要有 `parentId` 这种关联字段，先做一次分组，后续查找都是 O(1)
3. **`useMemo` 配合依赖数组** - 只在 `comments` 变化时重新计算，正常编辑操作（输入框打字等）不会触发重算
