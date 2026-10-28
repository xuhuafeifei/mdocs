# map — ops

人读长文：[`../archive/development-environment.md`](../archive/development-environment.md)、[`testing-strategy.md`](../archive/testing-strategy.md)、[`clean-room-policy.md`](../archive/clean-room-policy.md)

### 开发脚本

- **关键词**：`pnpm dev` `typecheck` `build` `vitest`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `package.json` | scripts |
  | `vite.config.ts` | Vite / 代理 |
  | `CLAUDE.md` | 命令速查 |

### 前端依赖预构建（Vite optimizeDeps）

- **关键词**：`optimizeDeps` `include` `exclude` `mermaid` `@braintree/sanitize-url` `does not provide an export named` `#root:empty` `mdocs 加载中` `.vite/deps`
- **结论**：`mermaid` 在 `exclude` 里（规避 mermaid 11 动态 chunk 预构建后 `Failed to fetch`），所以它的 **CJS 依赖必须逐个 nested include**，否则被裸发给浏览器 → 命名导出不存在 → React 不挂载 → `#root:empty::before` 的「mdocs 加载中…」永驻。当前已 include：`dayjs`（含 4 个 plugin）、`@braintree/sanitize-url`、`roughjs`、`d3-sankey`、`cytoscape-fcose`、`cytoscape-cose-bilkent`。改完配置必须清 `node_modules/.vite` 再重启，否则缓存让现象失真。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `vite.config.ts` | `optimizeDeps.include` `optimizeDeps.exclude` |
  | `src/web/index.html` | `#root:empty::before`（「加载中」占位，诊断误导源） |
  | `../bug-fixes/vite-mermaid-cjs-dep-blank-screen-2026-10-28.md` | 个案复盘 |

### Lobe UI 深导入（@lobehub/ui/es/*）

- **关键词**：`@lobehub/ui` `ConfigProvider` `ThemeProvider` `@lobehub/editor` `es/*` `does not provide an export named` `export *` `index.mjs`
- **结论**：`@lobehub/ui` 的 `./es/*` 映射到 `./es/*.mjs`，这些文件普遍只导出 **default**（`ConfigProvider as default`、`ThemeProvider as default`）。深导入一律用 default：`import ConfigProvider from "@lobehub/ui/es/ConfigProvider/index"`。写成具名 → 模块链接期 SyntaxError → `main.tsx` 不执行 → 整页「mdocs 加载中…」。同目录 `index.js` 是 `export * from './index.mjs'`（不转发 default），别让解析落到 `.js`。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/main.tsx` | `ConfigProvider` `ThemeProvider` 深导入 |
  | `node_modules/@lobehub/ui/es/*/index.mjs` | 真实 `export { … }` 形状 |
  | `../bug-fixes/lobehub-ui-deep-import-named-export-2026-10-28.md` | 个案复盘（与 mermaid 那条的同症状区分） |

### 上传大小

- **关键词**：`MDOCS_MAX_UPLOAD_BYTES` `maxUploadBytes` `server-settings` `File too large` `multer`
- **结论**：默认 **100MiB**；设置页「通用」可改，落盘 `~/.mdocs/server-settings.json`，热更新；覆盖 `/api/assets/upload`、`link-to-img`、Agent 附件。优先级：UI 落盘 > 环境变量 > 默认。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/config/server-settings.ts` | `getMaxUploadBytes` `setMaxUploadBytes` |
  | `src/server/routes/server-settings.routes.ts` | `GET/PUT /api/server-settings` |
  | `src/web/app/SettingsPage.tsx` | 通用 Tab 上传上限 |
  | `src/server/routes/assets.routes.ts` | `createUploader` |

### 测试

- **关键词**：`vitest` `jsdom` `in-memory sqlite`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/**/*.test.ts` | 单测并列源码 |

### Clean-room

- **关键词**：`markdown-docs` `clean-room` `不得抄袭`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `CLEAN_ROOM.md` | 政策正文 |
  | `../archive/clean-room-policy.md` | 开发文档说明 |
