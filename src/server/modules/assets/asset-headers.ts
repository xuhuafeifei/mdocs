/** Images only — used by link-to-img remote fetch. */
export const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
  ".jfif",
  ".pjpeg",
]);

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".pjpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".zip": "application/zip",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

/** 不再限制文件类型：任何文件都可上传。未知扩展名存为 .bin。 */
export function isAllowedAssetUpload(_originalname: string, _mimetype: string): boolean {
  return true;
}

function sanitizeDownloadName(raw: string | undefined): string | null {
  if (!raw) return null;
  const base = raw.replace(/\\/g, "/").split("/").pop()?.replace(/[\r\n"]/g, "").trim() ?? "";
  if (!base || base === "." || base === "..") return null;
  return base.slice(0, 180);
}

function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * 非图片：强制 octet-stream + attachment。
 * WKWebView 会对可预览 MIME（pdf/音频等）在页内打开；octet-stream 才会走下载回调。
 */
export function buildAssetResponseHeaders(
  ext: string,
  storedName: string,
  requestedName?: string,
): { contentType: string; contentDisposition?: string } {
  const normalized = ext.toLowerCase();
  if (IMAGE_EXT.has(normalized)) {
    return { contentType: CONTENT_TYPE_BY_EXT[normalized] ?? "application/octet-stream" };
  }
  const filename = sanitizeDownloadName(requestedName) ?? storedName;
  return {
    contentType: "application/octet-stream",
    contentDisposition: contentDispositionAttachment(filename),
  };
}
