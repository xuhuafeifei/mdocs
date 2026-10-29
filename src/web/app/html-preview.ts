/**
 * HTML 文档预览的沙箱 + CSP 策略 —— 单一事实来源。
 *
 * 安全边界（改动前请先读）：
 * 1. `sandbox` 只允许 `allow-scripts`，**绝不允许** `allow-same-origin`。
 *    两者同时出现时 iframe 可以自己摘掉 sandbox 属性、重载，进而读写 parent、
 *    用 cookie 调 /api —— 前面所有防护归零。见 html-preview.test.ts 的断言。
 * 2. CSP 从 `default-src 'none'` 起步：没有 fetch/XHR/WebSocket、没有第三方
 *    图片/CSS/字体/CDN、没有 `<meta http-equiv="refresh">` 外跳。
 * 3. 图片/媒体额外放行**本方部署 origin**（`assetOrigin`）：沙箱 iframe 是 opaque
 *    origin，`'self'` 永远不匹配，所以必须写绝对 origin。这样 `/api/assets/<id>`
 *    这类站内资源能显示；该路由本身是公开只读的，不需要 cookie。
 * 4. 脚本版预览 = opaque origin：localStorage / cookie / history.pushState 都不可用。
 */

/** 只读/静态预览：脚本一律不执行。 */
export const HTML_PREVIEW_SANDBOX_STATIC = "";
/** 允许脚本：仍然没有 allow-same-origin。 */
export const HTML_PREVIEW_SANDBOX_SCRIPTS = "allow-scripts";

export type HtmlPreviewOptions = {
  allowScripts: boolean;
  /** 本站 origin（如 https://mdocs.example.com）；用于放行 /api/assets 图片。 */
  assetOrigin?: string;
};

export function htmlPreviewCsp(options: HtmlPreviewOptions): string {
  // data:/blob: 走内联；本站 origin 让 /api/assets/<id> 可直接引用。
  const mediaSources = ["data:", "blob:", ...(options.assetOrigin ? [options.assetOrigin] : [])].join(
    " ",
  );
  return [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `img-src ${mediaSources}`,
    "font-src data:",
    `media-src ${mediaSources}`,
    "form-action 'none'",
    "base-uri 'none'",
    `script-src ${options.allowScripts ? "'unsafe-inline'" : "'none'"}`,
  ].join("; ");
}

/** iframe 的 sandbox 值；始终返回字符串，避免漏写属性变成"无沙箱"。 */
export function htmlPreviewSandbox(allowScripts: boolean): string {
  return allowScripts ? HTML_PREVIEW_SANDBOX_SCRIPTS : HTML_PREVIEW_SANDBOX_STATIC;
}

/**
 * 把 HTML 原文包成预览文档。
 * meta CSP 必须出现在 head 早期——浏览器会忽略后插入的 meta CSP。
 */
export function buildHtmlPreviewDocument(content: string, options: HtmlPreviewOptions): string {
  const parts = [
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\">",
    `<meta http-equiv="Content-Security-Policy" content="${htmlPreviewCsp(options)}">`,
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `</head><body>${content}</body></html>`,
  ];
  return parts.join("");
}

/** 文档里是否含脚本标签（用于给作者提示"脚本已启用"）。 */
export function hasInlineScript(content: string): boolean {
  return /<script[\s>]/i.test(content);
}
