# 自动保存草稿机制

## 概述

mdocs 前端在编写文档时自动将内容保存到浏览器 IndexedDB 中作为本地草稿。该机制由以下几个模块协作完成：

| 模块 | 文件 | 职责 |
|------|------|------|
| IndexedDB 存储 | `src/web/storage/drafts.ts` | 草稿的读写删（`saveDraft` / `getDraft` / `deleteDraft`） |
| 自动保存 Hook | `src/web/app/hooks/useAutoSave.ts` | Lexical update listener 监听内容变化，节流后自动写 IndexedDB |
| 导航守卫 | `src/web/app/App.tsx` → `guardNavigate()` | 切走文章前通过 `saveBeforeNavRef` 调用 `saveDraft()` 落盘 |
| 手动保存 | `src/web/app/DocumentEditor.tsx` → `saveDraft()` | 暴露给 App.tsx 的导航前保存函数 |

## 数据流

```
用户编辑 → Lexical update → registerUpdateListener
                                ↓
                         markdown 与 lastContentRef 比较
                           ↙ 相同：跳过          ↘ 不同：标记 dirty
                                                    ↓
                                              debounce 1s 后
                                                    ↓
                                              performSave()
                                                    ↓
                                        saveDraft() → IndexedDB
                                                    ↓
                                        lastContentRef = 当前 markdown
```

此外还有三种紧急保存场景会绕过 debounce 直接调 `performSave()`：
- **blur**：编辑器失焦时，如果 dirty 则立即保存
- **visibilitychange**：切 tab 时立即保存
- **beforeunload**：关闭/刷新页面前立即保存

## 切换文章时误生成草稿的 Bug

### 现象

用户点击文章树切换到某篇文章，即使没有做任何编辑，IndexedDB 中立即出现一条该文章的草稿记录。

### 根因（两个独立问题）

#### 问题一：JSON 比较误判内容变化

`lastContentRef` 原本存储 Lexical 编辑器导出的 JSON 字符串，作为"上次保存时的内容"基准。但 Lexical 的 JSON 序列化包含内部状态（node keys、selection 等）：

- **切换文章** → Editor 重新挂载 → `setDocument()` 设置内容 → Lexical 内部节点重建 → node key 重新生成
- JSON 字符串变了（长度可能相同但内容不同），但文章实际文本没变
- `jsonContent === lastContentRef.current` → false → 标记 dirty → 触发保存

#### 问题二：导航守卫无条件保存

`App.tsx` 的 `guardNavigate()` 在每次切文章前都会调用 `saveBeforeNavRef.current()`，即 `DocumentEditor.saveDraft()`。该函数**不检查内容是否变化**，直接写 IndexedDB。即使问题一不存在，也会在切走时创建上一篇文章的草稿。

### 修复方案

#### 修复一：改用 markdown 做脏检测

将 `lastContentRef` 存储的内容从 JSON 改为 **markdown 文本**。

JSON vs markdown 的差异：

```
JSON:   {"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","key":"abc123",...
        ↑ 包含 node key "abc123"，Lexical 重建 DOM 会生成新的 key
        
markdown: "# 标题\n\n正文内容..."
          ↑ 只反映文档实际文本，不受内部状态影响
```

改动涉及 `useAutoSave.ts` 中三个位置：

```
1. Effect 2 初始化基线：  lastContentRef = editor.getDocument("markdown")
2. updateListener 比较：   const md = editor.getDocument("markdown"); md === lastContentRef?
3. performSave/markDraftSaved 更新基线：lastContentRef = editor.getDocument("markdown")
```

**实际写入 IndexedDB 的仍然是 JSON**（保证 Lexical 状态可恢复），`lastContentRef` 只是内存中的比较基准。

#### 修复二：导航守卫检查 dirty 状态

`DocumentEditor.saveDraft()` 增加入口判断：`if (!_isDirty) return;`。未编辑过的文档切走时不写 IndexedDB。

#### 修复三：Effect 1 不再覆盖基线

原来 `useAutoSave` 的 Effect 1（`getDraft` 异步回调）会在无草稿时将 `lastContentRef` 设为空字符串 `""`，这会覆盖 Effect 2 设置的 markdown 基线。移除 Effect 1 中对 `lastContentRef` 的所有赋值。

## 关键设计决策

**为什么不直接用 hash 比较？**

hash（如 SHA-256）可以达到同样效果，但 markdown 字符串比较更简单：已经读了编辑器内容，直接比字符串就行，不需要额外算 hash。效果等同于 hash——只要文档文本不变，不触发保存。

**为什么 `lastContentRef` 设为空字符串时要跳过保存？**

`performSave()` 入口有 `if (!lastContentRef.current) return`。这是兜底：如果基线还没初始化（空字符串），绝不写 IndexedDB。切文章时 Editor 重新挂载，baseline 在 Effect 2 中设置，如果因为时序问题还没设好，这个 guard 能防住。

## 调试日志

关键日志位置便于排查问题：

```
[useAutoSave] updateListener dirty   ← Lexical 检测到内容变化
[useAutoSave] performSave saving     ← 自动保存触发
[useAutoSave] performSave blocked    ← 被空基线拦截（不保存）
[DocumentEditor.saveDraft] saving    ← 导航守卫触发保存
[DocumentEditor.saveDraft] skipped   ← 导航守卫跳过（内容未变）
```
