import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** 一次 CLI 上传的结果。 */
export type UploadedAsset = {
  /** 调用方传入的原始路径。 */
  source: string;
  /** 资源 ID（服务端文件名，不含扩展名）。 */
  id: string;
  /** 站内公开路径，可直接放进 HTML/Markdown。 */
  publicPath: string;
  /** 带 origin 的完整 URL（传了 baseUrl 才有）。 */
  url?: string;
  bytes: number;
};

/** CLI 上传失败（文件不存在 / 超过大小上限等）。 */
export class AssetUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetUploadError";
  }
}

export type UploadAssetOptions = {
  /** 目标目录，通常是 `<dataDir>/files/assets`。 */
  assetsDir: string;
  /** 单文件上限，取设置页/环境变量里的 maxUploadBytes。 */
  maxBytes: number;
  /** 可选：拼出绝对 URL，例如 `http://localhost:4000`。 */
  baseUrl?: string;
};

function normalizeBaseUrl(baseUrl?: string): string | undefined {
  if (!baseUrl) return undefined;
  const trimmed = baseUrl.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, "");
}

/**
 * 把本地文件复制进 assets 目录，命名规则与 HTTP 上传一致：
 * `<uuid><ext>`，扩展名小写，无扩展名落 `.bin`。
 *
 * 先整体校验再落盘，避免中途失败留下半套文件。
 */
export function uploadAssetFiles(files: string[], options: UploadAssetOptions): UploadedAsset[] {
  if (files.length === 0) {
    throw new AssetUploadError("no files given");
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const planned: Array<{ source: string; absolute: string; size: number; ext: string }> = [];

  for (const file of files) {
    const absolute = path.resolve(file);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(absolute);
    } catch {
      throw new AssetUploadError(`file not found: ${file}`);
    }
    if (!stat.isFile()) {
      throw new AssetUploadError(`not a regular file: ${file}`);
    }
    if (stat.size > options.maxBytes) {
      const limitMb = (options.maxBytes / 1024 / 1024).toFixed(1);
      throw new AssetUploadError(
        `file too large: ${file} (${(stat.size / 1024 / 1024).toFixed(1)} MB > ${limitMb} MB)`,
      );
    }
    const ext = path.extname(absolute).toLowerCase() || ".bin";
    planned.push({ source: file, absolute, size: stat.size, ext });
  }

  fs.mkdirSync(options.assetsDir, { recursive: true, mode: 0o700 });

  return planned.map(({ source, absolute, size, ext }) => {
    const id = crypto.randomUUID();
    const fileName = `${id}${ext}`;
    fs.copyFileSync(absolute, path.join(options.assetsDir, fileName));
    const publicPath = `/api/assets/${fileName}`;
    return {
      source,
      id,
      publicPath,
      ...(baseUrl ? { url: `${baseUrl}${publicPath}` } : {}),
      bytes: size,
    };
  });
}
