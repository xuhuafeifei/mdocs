# @lobehub/ui 深导入写错导出名 → 首屏整页不挂载

> 一句话：`@lobehub/ui/es/*` 子路径只导出 **default**，写成具名导入就 `does not provide an export named 'X'`；`main.tsx` 一挂，整页又是「mdocs 加载中…」。

## 现象

- 打开任意页面（含 `/#/doc/<id>`）白屏 / 停在「mdocs 加载中…」，`#root` 无子节点。
- console 只有一条错误：

  ```
  Uncaught SyntaxError: The requested module '/@fs/.../.vite/deps/@lobehub_ui_es_ConfigProvider_index.js?v=...'
  does not provide an export named 'ConfigProvider' (at main.tsx:10:10)
  ```

- **与 2026-10-28 早前那次（mermaid 的 CJS 依赖被裸发）症状完全一样**，根因却不同 → 极易被当成同一个 bug 反复改配置。

## 根因

1. `@lobehub/ui` 的 exports 是 `"./es/*": { "types": "./es/*.d.mts", "import": "./es/*.mjs" }`，所以 `@lobehub/ui/es/ConfigProvider/index` 解析到 `es/ConfigProvider/index.mjs`。
2. 该文件只有一行导出：`export { ConfigContext, I18nContextInternal, ConfigProvider as default, useCdnFn, useI18n }` —— **`ConfigProvider` 只有 default**，没有具名。`ThemeProvider` 同理（`ThemeProvider as default`）。
3. 写成 `import { ConfigProvider } from "@lobehub/ui/es/ConfigProvider/index"` → 模块链接期抛 SyntaxError → `main.tsx` 后面的 `createRoot(...).render(...)` 根本没执行。
4. **附带陷阱**：同目录还有 `index.js` / `index.d.ts`，内容是 `export * from './index.mjs'`。`export *` **不转发 default**，所以任何让解析落到 `.js` 的改动（改 exports、加 alias、换 bundler 条件）都会让 default 变 `undefined`，报错文案变成 `does not provide an export named 'default'`。

## 方案

`src/web/main.tsx` 用 default 导入（现状即如此，别再"改对"成具名）：

```ts
import ConfigProvider from "@lobehub/ui/es/ConfigProvider/index";
import ThemeProvider from "@lobehub/ui/es/ThemeProvider/index";
```

需要同模块的具名成员（如 `useCdnFn` / `ConfigContext`）时，具名导入那些**真实存在**的名字，不要把 default 改写成同名具名。

排查动作固定为一步：打开 `node_modules/@lobehub/ui/es/<X>/index.mjs` 看那行 `export { … }`，不要信 IDE 补全，也不要信 `.d.ts` 里的 `export *`。

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `src/web/main.tsx` | `ConfigProvider` / `ThemeProvider` 导入 | 修复点（本次是把具名改回 default） |
| `node_modules/@lobehub/ui/es/ConfigProvider/index.mjs` | `ConfigProvider as default` | 真实导出形状 |
| `node_modules/@lobehub/ui/es/ConfigProvider/index.js` | `export * from './index.mjs'` | 不转发 default 的陷阱 |
| `vite.config.ts` | `optimizeDeps` | **与本次无关**，勿混诊 |

## 验证

- 改回 default 导入 → 刷新 → `[contenteditable=true]` 出现、文档正常打开；console 仅剩 React 19 噪音（`flushSync ...`、`element.ref ...`）。
- 区分两种白屏的最快判据：报错里的模块路径 / 成员名
  - 裸包路径（`@fs/.../node_modules/@braintree/sanitize-url/...`）+ 裸包成员名 ⇒ 依赖预构建漏项，改 `vite.config.ts`
  - 预构建产物（`.vite/deps/...`）+ **自家 import 的成员名** ⇒ 导入写法错，改 `import` 语句

## 可复用模式（已写入 `map/ops.md`）

- 深导入 `@lobehub/ui/es/*` 一律 **default-first**：先看 `index.mjs` 的 `export` 行，再决定 import 写法。
- 「白屏 + 永远加载中」三步定位：`#root.childElementCount` → console 首条 SyntaxError → 报错模块路径属于哪一类（预构建产物 / 裸包 / 自家源码）。
- 换 `@lobehub/editor` 的消费方式（`file:../my-lobe-editor` ↔ `file:...fork.NN.tgz`）与本问题无关，别把两者串成因果。
