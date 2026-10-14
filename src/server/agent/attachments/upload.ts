import multer from "multer";

/**
 * 浏览器按 UTF-8 写 multipart 的 filename。
 * multer 默认用 latin1 解码，中文会变成「æªå¾.png」这种乱码。
 */
export const agentAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  defParamCharset: "utf8",
});
