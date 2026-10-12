/** 是否按 Apple 修饰键约定（⌘）处理快捷键。 */
export function isAppleModPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X|Macintosh/i.test(ua);
}

/** 桌面发布快捷键文案：Mac ⌘+Enter，其它 Alt+Enter。 */
export function publishHotkeyLabel(): string {
  return isAppleModPlatform() ? "⌘+Enter" : "Alt+Enter";
}

/** 当前按键是否匹配发布快捷键。 */
export function isPublishHotkey(e: KeyboardEvent): boolean {
  if (e.key !== "Enter") return false;
  if (e.shiftKey || e.ctrlKey) return false;
  if (isAppleModPlatform()) {
    return e.metaKey && !e.altKey;
  }
  return e.altKey && !e.metaKey;
}
