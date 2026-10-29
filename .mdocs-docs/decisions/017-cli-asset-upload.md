# 017 — CLI 直传 assets（`mdocs asset upload`）

- **状态**：accepted（2026-10-29）
- **上下文**：HTML 文档放开脚本后可以直接引用站内 `/api/assets/<id>`（见 ADR 016），但拿到 id 的唯一入口是**网页上传**：要先打开文档、要有编辑权限、要带 cookie。命令行 / Agent 侧没有批量入口，做原型时贴图很别扭。
- **选项**：
  1. **走 HTTP**：CLI 调 `POST /api/assets/upload`。需要 CLI token，且该路由会 `assertDocumentOwner(documentId)`，必须先有一个可写文档。
  2. **直接落盘**：CLI 读 `getConfig().assetsDir`，按 `<uuid><ext>` 复制文件，输出公开路径。
- **决策**：采用 **2**。CLI 本来就跑在服务器本机（`visitor list` 直接读 SQLite 也是这个前提），不需要再引入 token 与文档归属概念。
- **后果**：
  - ✅ 零鉴权依赖、可批量、离线可用；命名规则与网页上传完全一致，产出路径可直接粘进 HTML/Markdown。
  - ⚠️ 绕过 HTTP 层：不做 mime 校验（与 ADR 013「上传不限制类型」一致），但**仍复用** `getMaxUploadBytes()` 的单文件上限；assets 是全局公开只读资源，不产生「归属于某文档」的关系。
  - ⚠️ 调用方需要本机 shell 权限，等同于已有权限，**不新增远程攻击面**。
- **落点**：
  | 位置 | 说明 |
  |------|------|
  | `src/server/cli/asset-upload.ts` | `uploadAssetFiles`：先整体校验（存在/是文件/超限）再落盘，避免半套文件 |
  | `src/server/cli/main.ts` | `asset upload` 分发 + usage；`--base-url` / `--json` |
  | `src/server/cli/asset-upload.test.ts` | 命名、`.bin` 兜底、超限不落盘、缺文件 |
- **回退**：删掉子命令即可，已落盘资源仍可访问（只是没有批量入口）。
