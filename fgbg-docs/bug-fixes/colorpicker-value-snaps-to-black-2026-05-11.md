# ColorPicker 选色后跳回黑色 BUG 修复记录

## 现象

在 mdocs 中划词后，通过浮动工具栏的 ColorPicker 选择颜色，颜色面板会立即跳回黑色（defaultColor）。选色动作实际上能生效（编辑器中文本颜色确实改变了），但 ColorPicker 的显示值瞬间重置。

在 my-lobe-editor 的 demo 环境中此问题不出现。

## 根因

**`useEditorState` 的 `$updateToolbar` 方法在 selection 为 null 时清空了 `textColor` 和 `bgColor`。**

完整链路：

1. 用户划词 → 浮动工具栏出现 → `useEditorState` 从 TextNode 的 style 中正确读取到 `textColor`
2. 用户点击 ColorPicker → antd `<ColorPicker>` 的 popup 渲染在 `document.body` 上（`getPopupContainer={() => document.body}`）
3. 编辑器失焦 → Lexical 的 `$getSelection()` 返回 **null**
4. 选色完成后调用 `editorState.setTextColor(color)` → 触发 Lexical `editor.update()` → 触发 `registerUpdateListener` → 调用 `$updateToolbar`
5. `$updateToolbar` 中 `$getSelection()` 返回 null → 进入 `else if (!selection)` 分支 → 执行 `setTextColorState('')` 和 `setBgColorState('')`
6. `ColorPickerBtn` 的 `value` prop 变为 `''` → 回退到 `defaultColor`（`#000000`）→ 颜色面板跳回黑色

**关键代码（`useEditorState/index.ts`）：**

```typescript
} else if (!selection) {
  // ... 其他状态重置
  setTextColorState('');   // ← 问题所在
  setBgColorState('');     // ← 问题所在
}
```

## 为什么 my-lobe-editor demo 不受影响？

demo 环境中 selection 在 ColorPicker 交互期间可能因为更少的插件/回调而保持有效（未被清除）。但 mdocs 中 autosave、更多插件等导致焦点更容易被抢走，selection 更容易变为 null。

## 修复方案

删除 `else if (!selection)` 分支中的 `setTextColorState('')` 和 `setBgColorState('')`。

**理由：**
- 当 selection 为 null 时，只表示"当前没有活跃选区"，不代表"选中的文字没有颜色"
- 保留上一次检测到的颜色值不会影响正常行为——用户重新选择有颜色的文字时，`$updateToolbar` 仍会从 TextNode 的 style 中正确读取新颜色并覆盖旧值
- 其他状态（isBold、isItalic 等）仍正常清空，因为它们表示"当前选中文字的格式状态"，没有选区时确实应该重置

### 修改文件

1. **my-lobe-editor 源码**：`src/react/hooks/useEditorState/index.ts` — 删除 `else if (!selection)` 分支中的 `setTextColorState('')` 和 `setBgColorState('')`
2. **mdocs 已安装包**（临时验证）：`node_modules/.../@fgbg/lobe-editor/es/react.js` — 同步删除对应两行

## 涉及文件

- `my-lobe-editor/src/react/hooks/useEditorState/index.ts` — 主修复位置
- `my-lobe-editor/src/react/ColorPickerBtn.tsx` — 受影响的 UI 组件（本身无需修改）
- `mdocs/src/web/app/Toolbar.tsx` — ColorPicker 配置位置

## 经验教训

1. **selection 为 null 不等于"没有格式"** — null selection 只表示"当前没有选中内容"，不能据此推断格式状态应该重置
2. **popup 渲染在 body 上会导致编辑器失焦** — antd 的 `getPopupContainer={() => document.body}` 使得 popup 点击不会保持编辑器焦点，容易触发 selection 变化
3. **在 "状态清空" 分支中要区分"无选中内容"和"选中内容为空格式"** — format 状态（bold/italic）可以清空，但颜色这类持久化到 node style 上的属性不应在无选区时清空
4. **同一份代码在不同项目中表现不同** — mdocs 相比 my-lobe-editor 有更多插件和回调，更容易暴露竞态和边界条件
