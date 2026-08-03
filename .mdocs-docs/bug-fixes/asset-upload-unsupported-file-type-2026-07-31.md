# asset-upload-unsupported-file-type-2026-07-31

> 一句话：编辑器侧已支持 zip/音频附件，但 mdocs `/api/assets/upload` 只放行图片，导致 `unsupported file type`；随后将单文件上限从 12MB 提到 55MB。

## 现象

上传 zip / mp3 时接口返回：

`{"code":1,"msg":"unsupported file type","data":{"errFiles":[],"succMap":{}}}`

随后大文件返回：

`{"code":1,"msg":"File too large",...}`

## 根因

1. `assets.routes.ts` 的 multer `fileFilter` 白名单仅含图片扩展名，并强制 `mimetype` 以 `image/` 开头。
2. `MAX_BYTES` 原为 12MB，multer `limits.fileSize` 超限会报 `File too large`。

## 方案

- 上传白名单增加 `.zip` 与常见音频扩展名
- `link-to-img` 仍仅允许图片
- 单文件上限改为 **55MB**
- 下载响应为非图片设置合理 `Content-Type` / `Content-Disposition`
- 前端 `uploadAssetApi` 识别 Vditor `code:1` 并透出 `msg`

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `src/server/routes/assets.routes.ts` | `ALLOWED_UPLOAD_EXT` `MAX_BYTES` `fileFilter` | 类型 + 大小 |
| `src/web/services/endpoints.ts` | `uploadAssetApi` | 解析失败 msg |

## 验证

拖入 ≤55MB 的 zip / mp3 → 上传成功 → 附件卡片可下载。图片上传与 link-to-img 行为不变。
