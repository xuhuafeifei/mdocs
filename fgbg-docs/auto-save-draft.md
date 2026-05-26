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

## 补充 Bug：useCallback 依赖循环

### 现象

`useAutoSave` 的 `performSave` 函数依赖 `documentId`、`displayName`、`documentMeta` 等多个 props，而这些 props 在每次渲染时都可能变化（尤其是 `documentMeta` 是新对象）。

结果：
- 每次渲染 → `performSave` 引用变化 → 触发 `registerUpdateListener` 反复注销+注册 → 增加性能开销

### 根因

```typescript
const performSave = useCallback(async () => {
  // 使用了 documentId, displayName, documentMeta
  ...
}, [editor, documentId, displayName, documentMeta]);  // ← 依赖数组包含所有用到的变量
```

- `documentMeta` 是每次渲染都创建的新对象 → 导致 `performSave` 每次渲染都变化 → 导致 `registerUpdateListener` 反复注销+注册

### 修复方案

使用 **`useRef` 保存频繁变化的值**，而非将它们放入依赖数组：

```typescript
// 使用 ref 保存最新值，避免依赖数组膨胀
const documentIdRef = useRef(documentId);
const displayNameRef = useRef(displayName);
const documentMetaRef = useRef(documentMeta);

// 每次渲染同步最新值
documentIdRef.current = documentId;
displayNameRef.current = displayName;
documentMetaRef.current = documentMeta;

// useCallback 只依赖 editor，引用稳定
const performSave = useCallback(async () => {
  ...
  await saveDraft({
    documentId: documentIdRef.current,  // 从 ref 读取最新值
    content: jsonContent,
    displayName: displayNameRef.current,
    ...documentMetaRef.current,
  });
  ...
}, [editor]);
```

### 关键设计决策

**为什么不直接用一个 ref 存整个 props 对象？**

分开的三个 ref 更清晰，语义明确，每个 ref 对应一个值。也便于后续扩展。

**为什么 `editor` 仍然放在依赖数组？**

`editor` 是 `IEditor | null`，只有在编辑器初始化完成后才会有值，变化频率很低（只有在切换文章时才会变化一次）。放在依赖数组里是安全的。

---

## BUG：切换设置页后返回丢失编辑内容（2026-05-17）

### 现象

用户编辑文档 → 点击头像进入设置页 → 返回文档 → 之前编辑的内容不见了，回到了上次发布时的状态，但控制台日志显示草稿确实已经保存到了 IndexedDB。

### 根因

**数据流向断层**：

```
App.tsx openDocument(1)
  ↓
从 getDraft(doc1) 读到内容 A
  ↓
setActiveDoc({ content: A })  ← 传给 Editor props
  ↓
DocumentEditor ← props.document.content = A
  ↓
用户编辑 → content 变成 B
  ↓
auto-save Hook → saveDraft(doc1, B) → IndexedDB ✅
  ↓
切到设置页 → App view = "settings"（Editor 卸载）
  ↓
返回文档页 → URL 还是 /doc/1
  ↓
useEffect([phase, documentId]) 再次触发
  ↓
openDocument(1) 再次执行
  ↓
getDraft(doc1) 读到草稿内容 B ✅
  ↓
draft 有 relativePath → 命中第一个分支，准备 setActiveDoc ✅
  ↓
expectedDocIdRef.current === docId ✅
  ↓
setActiveDoc({ content: B, ... })  ← 新值入队，React 渲染
  ↓
React 检测到 DocumentEditor 已经存在（没有 key 变化），直接复用
  ↓
DocumentEditor 收到 props.document.content = B
  ↓
BUT: DocumentEditor 的 handleInit 只在 Editor 挂载时执行
     而如果 Editor 已经存在，handleInit 不会重新执行 ❌
  ↓
Editor 仍然显示旧的 A，与 props.document.content = B 不同步 ❌
```

**根本问题**：`openDocument()` 正确从 IndexedDB 读取了最新草稿并 `setActiveDoc`，但 `DocumentEditor` 组件复用了已存在的编辑器实例，**没有重新设置内容**。

`handleInit` 只在 `useCallback` 的依赖（`contentType`）变化时才会触发，或者在新的 Editor 实例挂载时触发。如果组件复用，旧内容就残留了。

### 修复方案

**文件**：`src/web/app/DocumentEditor.tsx`

在组件挂载（`editor` 变化）或 `documentId` 变化时，主动检查并从 IndexedDB 恢复草稿内容：

```typescript
/**
 * 编辑器初始化后，检查并加载本地草稿内容和标题。
 * 处理场景：编辑内容 → 切到设置页 → 返回文档页，此时 activeDoc 是旧的服务器内容。
 */
useEffect(() => {
  if (!editor) return;
  getDraft(props.document.documentId).then((draft) => {
    if (draft && draft.content !== props.document.content) {
      console.log("[DocumentEditor] restoring draft after remount, documentId:", props.document.documentId);
      try {
        editor.setDocument("json", draft.content);
        // 如果草稿标题与文档标题不同，也更新显示名称
        if (draft.displayName && draft.displayName !== props.document.displayName) {
          setDisplayName(draft.displayName);
        }
      } catch {
        // 忽略错误
      }
    }
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [editor, props.document.documentId]);
```

**设计要点**：
- 触发时机：`editor` 从 `null` 变为实例（重新挂载），或 `documentId` 变化
- 比较判断：`draft.content !== props.document.content` 确保只有草稿更新时才覆盖（避免正常打开文档的不必要操作）
- 同时恢复标题：`displayName` 可能被用户编辑过但未发布
- `getDraft` 需要导入：原文件只有 `saveDraft` 的导入，需要补充 `getDraft`

**数据流对比**：

| 修复前 | 修复后 |
|--------|--------|
| 1. openDocument 读到草稿 B | 1. openDocument 读到草稿 B |
| 2. setActiveDoc(B) | 2. setActiveDoc(B) |
| 3. Editor 复用旧实例 | 3. Editor 复用旧实例 |
| 4. Editor 仍显示 A ❌ | 4. useEffect 触发，editor.setDocument("json", B) ✅ |

**修改文件**：
- `src/web/app/DocumentEditor.tsx` - 新增挂载后恢复草稿的 useEffect
- 导入新增：`import { saveDraft as saveDraftToIdb, getDraft } from "../storage/drafts";`

### 验证要点

1. ✅ 编辑文档不发布 → 切到设置页 → 返回文档：看到的是编辑后的内容，不是上次发布的版本
2. ✅ 标题修改也会恢复（不仅仅是正文）
3. ✅ 正常打开新文档不受影响（没有草稿时跳过）
4. ✅ 自动保存日志正常工作，无异常报错

