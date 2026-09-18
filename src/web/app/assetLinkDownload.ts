/**
 * 附件卡片是 `<a download target="_blank">`。
 * 桌面壳默认拒绝新窗口，Android WebView 也不打开 target=_blank，
 * 两边都会把这次点击吃掉。改成当前页打开，靠 Content-Disposition 触发下载。
 */

const IMAGE_EXT = new Set([
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

function extOf(pathname: string): string {
  const base = pathname.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

/** 同源非图片 `/api/assets/` 才拦截。返回 null 表示走链接原行为。 */
export function assetDownloadTarget(
  href: string,
  downloadName: string | null,
  pageHref: string,
): string | null {
  let page: URL;
  let url: URL;
  try {
    page = new URL(pageHref);
    url = new URL(href, pageHref);
  } catch {
    return null;
  }
  if (url.origin !== page.origin) return null;
  if (!url.pathname.startsWith("/api/assets/")) return null;
  if (IMAGE_EXT.has(extOf(url.pathname))) return null;
  const name = downloadName?.trim();
  if (name && !url.searchParams.has("name")) {
    url.searchParams.set("name", name);
  }
  return url.toString();
}

export function installAssetLinkDownloads(): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const path = event.composedPath();
    const anchor = path.find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
    if (!anchor) return;
    const target = assetDownloadTarget(anchor.href, anchor.getAttribute("download"), window.location.href);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(target);
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
