/**
 * 必须在点击回调里同步执行。桌面 WebView / http 页的 Clipboard API 常拒绝，
 * 且一旦 await 就会丢掉用户手势，之后的 execCommand 也会失败。
 */
function copyWithExecCommand(value: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 复制到剪贴板。先同步 execCommand（WebView），再试 Clipboard API。 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.replace(/\u00a0/g, " ");
  if (!value) return false;

  if (copyWithExecCommand(value)) return true;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* Clipboard API 在非安全上下文或 WebView 里会拒绝 */
  }
  return false;
}
