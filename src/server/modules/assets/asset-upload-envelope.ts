/**
 * 附件上传 HTTP 信封（不走统一 `{ data }` 包装）。
 * 字段形状来自历史上的 Vditor 上传协议；编辑器已换，前端 `uploadAssetApi` 仍按此解析。
 */
export type AssetUploadEnvelope = {
  msg: string;
  code: 0 | 1;
  data: unknown;
};

export function isAssetUploadEnvelope(v: unknown): v is AssetUploadEnvelope {
  if (!v || typeof v !== "object") return false;
  const o = v as { code?: unknown; msg?: unknown; data?: unknown };
  return (
    (o.code === 0 || o.code === 1) &&
    typeof o.msg === "string" &&
    "data" in o
  );
}

export function assetUploadSuccess(succMap: Record<string, string>): AssetUploadEnvelope {
  return { msg: "", code: 0, data: { errFiles: [] as string[], succMap } };
}

export function assetUploadError(msg: string): AssetUploadEnvelope {
  return { code: 1, msg, data: { errFiles: [] as string[], succMap: {} } };
}

export function assetLinkToImgOk(originalURL: string, url: string): AssetUploadEnvelope {
  return { msg: "", code: 0, data: { originalURL, url } };
}
