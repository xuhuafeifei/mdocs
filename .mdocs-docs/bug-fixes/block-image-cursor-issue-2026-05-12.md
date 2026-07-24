# Block 图片插入后光标异常修复记录

## 现象

在编辑器中插入 block 图片（`defaultBlockImage=true`）后，光标行为异常：
- 光标横着贴在图片下方，没有跳到新行
- 用户难以通过键盘 Backspace 删除图片
- 图片插入后无法直接继续输入文字

## 根因

**三个插入路径都存在相同问题：block 图片插入后没有追加空 paragraph 并移动光标。**

### 路径 1：`INSERT_IMAGE_COMMAND`（命令式插入）

```typescript
// command/index.ts
$insertNodes([imageNode]);
// block 图片路径什么都不做——光标留在原地
if (!isBlock && $isRootOrShadowRoot(imageNode.getParentOrThrow())) {
  $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
}
// ← isBlock 时没有任何后续处理
```

### 路径 2：Markdown 快捷键（`![](url)` + 回车）

除了缺少空 paragraph 的问题外，还有一个更严重的 bug：**markdown 快捷键把 block 图片直接放在原有 `<p>` 内部**，没有提升到 root 层级。

```typescript
// plugin/index.ts
markdownService.registerMarkdownShortCut({
  replace: (node, match) => {
    const imageNode = $createBlockImageNode({ ... });
    node.replace(imageNode);  // ← 只在 paragraph 内部替换 text node
    // ← 图片被包裹在 <p> 内，不是 root 层级的 block 元素
  }
});
```

这导致图片被当作 inline 元素渲染，光标横着贴在图片旁边。

### 路径 3：粘贴图片 URL

与路径 1 相同的问题——block 图片插入后没有后续 paragraph。

## 修复方案

### 路径 1 和 3：追加空 paragraph

```typescript
} else if (isBlock) {
  const emptyPara = $createParagraphNode();
  imageNode.insertAfter(emptyPara);
  emptyPara.selectEnd();
}
```

### 路径 2：将图片提升到 root 层级

```typescript
if (defaultBlockImage) {
  const parent = node.getParent();
  if (parent && $isRootOrShadowRoot(parent.getParent())) {
    const emptyPara = $createParagraphNode();
    parent.replace(imageNode);      // 整个 paragraph 替换为图片
    imageNode.insertAfter(emptyPara);  // 图片后插入空行
    emptyPara.selectEnd();
  }
}
```

**核心思路：** `node.replace(imageNode)` 只替换 text node，图片仍在 `<p>` 内部。需要用 `parent.replace(imageNode)` 把整个 paragraph 提升到 root 层级。

## 涉及文件

- `my-lobe-editor/src/plugins/image/command/index.ts` — INSERT_IMAGE_COMMAND 修复
- `my-lobe-editor/src/plugins/image/plugin/index.ts` — markdown 快捷键 + 粘贴 URL 修复

## 经验教训

1. **Block 元素的插入层级很重要** — `node.replace()` 只替换当前节点，不改变父级容器。要插入真正的 block 元素，必须用 `parent.replace()` 提升到 root 层级
2. **三种插入路径要统一** — command、markdown shortcut、paste URL 是三条独立的代码路径，修复时容易漏掉某一条
3. **`$wrapNodeInElement` 是 inline 图片的惯用法** — non-block 图片用 `$wrapNodeInElement(imageNode, $createParagraphNode).selectEnd()` 把图片包裹在 paragraph 中并移动光标。block 图片不需要包裹，但需要后续 paragraph
