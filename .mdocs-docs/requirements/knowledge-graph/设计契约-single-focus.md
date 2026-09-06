# 知识图谱单一焦点（文档 | 图谱）— 设计契约

> **状态**：草案  
> **所属需求**：`knowledge-graph`（增量：焦点模型 + Ask 引用；不改图谱构建）  
> 关联：[`agent-mobile-context`](../agent-mobile-context/设计契约.md) 的 `references` 扩展  
> 未经「已同意」不得开始写业务代码。

## 方案摘要

**单一焦点**：全局同一时刻只指向一类对象——要么一篇普通 `md`，要么一个图谱隐藏资源（目录级 / 文章级 graph 缓存）。  
- 指向 `md` → **完全走现有**树高亮、`/doc/:id`、编辑器、Ask `documentId` 逻辑。  
- 指向图谱 → **另一套**树高亮 + 主区图谱页；**不**把隐藏文件 id 塞进旧的 `activeDocumentId` / 当正文编辑。  
- Ask 每轮引用 **当前焦点对应的那一个**：要么文章，要么隐藏文件，二者互斥。

不做「文档焦点 + 图谱焦点并存」。

## 目标 / 非目标

### 目标

1. 查看/生成图谱时，左侧有独立、可辨认的图谱焦点高亮（打在可见的父目录或关联正文行上）。
2. 进入图谱焦点时，退出正文焦点（树不再用旧选中样式；URL/编辑器按下方规则处理）。
3. Ask 引用芯片与 `references` 与焦点一致：文章 **或** 图谱隐藏文件。
4. 助手可只读引用隐藏图谱文件；禁止当普通文档 overwrite。

### 非目标

- 在文档树里画出隐藏文件行  
- 双焦点并存  
- coding / 帮写以 graph JSON 为工作区  
- 改 `___graph___.json` schema / 构建流水线  

## 焦点模型

```ts
type AppFocus =
  | { kind: "document"; documentId: string }
  | {
      kind: "graph";
      /** 目录级 ___graph___.json 或文章级 *.graph.json 的 documents.id */
      graphFileId: string;
      scope: "folder" | "domain" | "article";
      /** 树高亮锚点：可见的 folderId 或 article documentId */
      anchorId: string;
      label: string;
    };
```

| 切换动作 | 结果 |
|----------|------|
| 点击树上文 / 打开 `/doc/:mdId` | `focus = { kind: "document", documentId }`；清图谱焦点；主区编辑器（现有） |
| 查看图谱 / 生成图谱（目录或域） | `focus = { kind: "graph", ... }`；清正文焦点高亮；主区 `GraphPage` |
| 关闭图谱回到欢迎/上次文 | 显式切回 `document` 或 `null`（无焦点）；不得残留 graph 高亮 |
| 点树其它 md | 离开 graph focus，回 document 逻辑 |

**「清除以前的目录选择」**：指清除 **document 焦点的树高亮与 Ask 文章引用**，不是物理删草稿。进入 graph 时：

- `activeDocumentId` 用于树高亮的来源改为「仅 document focus」→ graph 时树 **不** 用旧 active 样式。  
- URL：进入图谱可用独立路由或 query（实现自选）；**禁止** `navigate(/doc/{graphFileId})` 把 JSON 当正文打开。  
- 编辑器：graph focus 下主区是图谱页；正文编辑器卸载或隐藏（与现 `GraphPage` 替换主区一致）。未保存草稿仍留在 IndexedDB，切回该 md 时恢复。

## 树 UI（图谱焦点）

- **不改** document 焦点下的选中 class / 自动展开逻辑。  
- graph focus 时：在 `anchorId` 对应行加 **另一套** class（如 `mdocs-tree-row--graph-focus`），视觉与正文选中区分（色相/描边/小 Network 标）。  
- 目录图谱 → `anchorId = folderId`；文章相关图谱操作 → `anchorId = 该 md 的 documentId`（高亮该文，不暴露 `__graph__` 行）。  
- 自动展开路径：按 `anchorId` 展开祖先（可复用现有 expand-to-active，但键改读 graph anchor）。

## Ask 引用

扩展（相对 `agent-mobile-context`）：

```ts
references?: {
  domainId?: string;
  /** 与 graphFileId 互斥 */
  documentId?: string;
  /** 与 documentId 互斥；指向隐藏 graph 文件 */
  graphFileId?: string;
};
```

| 焦点 | 发送 |
|------|------|
| `document` | `documentId`（用户未取消引用时）；不带 `graphFileId` |
| `graph` | `graphFileId`；不带 `documentId` |
| 无焦点 | 均可省略 |

UI 引用芯片：

- document：现有「当前文档」  
- graph：文案如「图谱：{label}」，可取消本轮引用（与现 docRefDismissed 同模式）

后端 system 注入：有 `graphFileId` 时写明「当前焦点为图谱缓存，只读；可用 get_document 读取该 id；禁止 overwrite」。  
`get_document`：**允许**读 `graph_file`（权限同域可读）；`overwrite_document` / coding：**拒绝** `graph_file`。

## 变更触达

| 文件 | 改动说明 |
|------|----------|
| `src/web/app/App.tsx` | `AppFocus` 状态；开图谱 / 开文档时互斥切换；传给树与 Agent |
| `src/web/app/DocumentTree.tsx` + CSS | `graphFocusAnchorId` + 独立高亮样式 |
| `src/web/app/AgentChatPanel.tsx` | 引用芯片双形态；`references` 互斥字段 |
| `src/web/services/endpoints.ts` | chat body 类型 |
| Agent run / references 注入 | 识别 `graphFileId` |
| `tools-documents` / overwrite | graph 只读、禁止写 |

## 风险与回滚

| 风险 | 应对 |
|------|------|
| 用户以为双开 | 文案与单一芯片表明「当前引用」只有一个 |
| 误把 graph 当 md 编辑 | 禁止 `/doc/graphFileId`；overwrite 拒写 |
| 切图谱丢写作上下文 | 草稿保留；切回 md 恢复；不强制丢 draft |

回滚：去掉 `graph` focus 分支，Ask 恢复只传 `documentId`。

## 测试要点

- [ ] 打开 md → 树旧高亮；Ask 带 `documentId`  
- [ ] 查看/生成图谱 → 树图谱高亮在 anchor；旧高亮消失；Ask 带 `graphFileId` 不带 `documentId`  
- [ ] 再点另一篇 md → 回 document 焦点；图谱高亮消失  
- [ ] 取消引用芯片后本轮不带对应 id  
- [ ] `get_document(graphFileId)` 可读；overwrite 返回错误  
- [ ] 不会因 graphFileId 进入正文编辑器

## 已对齐（待整体同意）

1. **单一焦点**（非双焦点并存）  
2. 指向 md → 老逻辑；指向图谱 → 新高亮 + 图谱主区  
3. Ask：**要么文章，要么隐藏文件**（当前焦点二选一）
