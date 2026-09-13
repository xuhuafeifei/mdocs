# 013 — 附件上传不做文件类型限制

- **状态**：accepted（2026-09-13）
- **取代**：`bug-fixes/asset-upload-unsupported-file-type-2026-07-31.md` 的「白名单」思路（该记录保留为历史）

## 上下文

`POST /api/assets/upload` 用 multer 收附件，`fileFilter` 走 `isAllowedAssetUpload(originalname, mimetype)` 做白名单校验。白名单演进过两轮：

| 时间 | 白名单范围 |
|------|-----------|
| 更早 | 仅图片 |
| 2026-07-31 | 图片 + `.zip` + 常见音频 + `.pdf`/`.txt`/`.md`/`.csv`/`.html`，且按扩展名校验 MIME 家族 |
| 2026-09-13 | **移除** |

到第二轮时已经出现明显摩擦：

1. 白名单是**穷举**，任何新类型（`.7z`、`.json`、`.js`、设计稿、日志…）都要改代码 + 发版
2. MIME 家族校验要求"扩展名与 `Content-Type` 匹配"，但不同浏览器/系统对同一文件给出的 MIME 不一致（`.md` 可能是 `text/markdown` / `text/plain` / 空），**误拒**比漏放更常见
3. mdocs 的附件定位是**团队知识库的素材托管**，不是面向公网的文件分享站。限制类型对真实威胁（恶意内容）没有实质防护，只挡了正常使用

## 决策

**`isAllowedAssetUpload` 恒返回 `true`，不再校验扩展名与 MIME。**

保留的约束（不随本决策放开）：

| 约束 | 值 | 说明 |
|------|-----|------|
| 单文件大小 | `MAX_BYTES = 55 MB` | 防止填满磁盘 |
| 单次文件数 | `files: 24` | multer `limits` |
| 存储文件名 | `{uuid}{ext}`，无扩展名时 `.bin` | 不信任原文件名；杜绝路径穿越 |
| 下载鉴权 | `/api/assets/:assetId` **公开 GET** | 注册在 auth 中间件之前；靠 UUIDv4 不可枚举 |
| 远程转存 | `link-to-img` **仍仅允许图片** | 该接口是"贴外链图自动转存"，语义上只该是图片 |

### 为什么放开类型不扩大「可执行内容内联」面

关键是**下载侧的 `Content-Type` 推导是白名单制，不是透传**：

```ts
const ct = HTML_EXT.has(ext)
  ? "application/octet-stream"
  : (CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream");   // 未登记 → octet-stream
```

- `.html` / `.htm`：**强制** `application/octet-stream` + `Content-Disposition: attachment`（防 XSS）
- `.zip` / `.pdf` / 音频：强制 `attachment`
- **未登记的任何新扩展名**：落到 `application/octet-stream`，浏览器当二进制下载，不解析执行

即"上传放开"与"下载可执行"是**解耦**的：放开上传只是让文件能进来，进来的东西一律不可内联执行。

**已知既有风险（非本决策引入）**：`.svg` 登记为 `image/svg+xml` 且不在强制下载列表内 → 同源内联；SVG 可携带脚本，理论上构成存储型 XSS。该行为在 2026-07-31 之前就存在。若要收紧，应把 `.svg` 也列入强制下载或用 `Content-Security-Policy: sandbox`，属独立议题。

## 后果

**正面**

- 任意附件可直接上传，不再需要为新类型改代码发版
- 删掉扩展名集合与 MIME 家族矩阵，`assets.routes.ts` 少约 30 行
- 消除"同一文件在不同系统被误拒"的支持成本

**负面 / 风险**

- 不再有早期类型拦截，恶意文件能落盘（但不可内联执行，见上）
- 磁盘占用只受 55MB × 24 约束，无配额体系；需靠运维监控
- 旧的 `.md` 附件与 `.md` 文档同名不同物，用户可能混淆（既有问题）

**后续可选**

- 上传配额 / 按域计量
- `.svg` 内联风险处置
- 附件类型在 UI 上给默认文件图标（前端表现，非本决策范围）
