import multer from "multer";
import { getMaxUploadBytes } from "../../config/server-settings.js";

/**
 * 浏览器按 UTF-8 写 multipart 的 filename。
 * multer 默认用 latin1 解码，中文会变成「æªå¾.png」这种乱码。
 * 单文件上限与资源上传共用 getMaxUploadBytes()（设置页可改，默认 100MiB）。
 */
export function createAgentAttachmentUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: getMaxUploadBytes(), files: 1 },
    defParamCharset: "utf8",
  });
}

/** @deprecated 测试兼容；生产路由请用 createAgentAttachmentUpload() */
export const agentAttachmentUpload = createAgentAttachmentUpload();
