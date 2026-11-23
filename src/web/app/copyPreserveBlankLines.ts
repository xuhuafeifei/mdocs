/**
 * 复制全文是否保留空行（空段落）。
 * 默认 true：跳过 remark 美化，避免连续空行被压掉。
 * 偏好只存本机 localStorage。
 */
export const COPY_PRESERVE_BLANK_LINES_KEY = "mdocs.copyPreserveBlankLines";

export function getCopyPreserveBlankLines(): boolean {
  try {
    return localStorage.getItem(COPY_PRESERVE_BLANK_LINES_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setCopyPreserveBlankLines(preserve: boolean): void {
  localStorage.setItem(COPY_PRESERVE_BLANK_LINES_KEY, String(preserve));
}
