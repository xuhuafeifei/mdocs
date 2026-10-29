import { describe, expect, it } from "vitest";

import {
  buildHtmlPreviewDocument,
  hasInlineScript,
  htmlPreviewCsp,
  htmlPreviewSandbox,
} from "./html-preview";

describe("html-preview 沙箱策略", () => {
  it("永远不出现 allow-same-origin", () => {
    for (const allowScripts of [true, false]) {
      expect(htmlPreviewSandbox(allowScripts)).not.toContain("allow-same-origin");
    }
    expect(htmlPreviewSandbox(true)).toBe("allow-scripts");
    expect(htmlPreviewSandbox(false)).toBe("");
  });

  it("CSP 默认全部拒绝，只放行内联样式与 data:/blob: 资源", () => {
    const csp = htmlPreviewCsp({ allowScripts: true });
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("style-src 'unsafe-inline'");
    expect(csp).toContain("img-src data: blob:");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("base-uri 'none'");
  });

  it("脚本开关只影响 script-src", () => {
    expect(htmlPreviewCsp({ allowScripts: true })).toContain("script-src 'unsafe-inline'");
    expect(htmlPreviewCsp({ allowScripts: false })).toContain("script-src 'none'");
    expect(htmlPreviewCsp({ allowScripts: false })).not.toContain("script-src 'unsafe-inline'");
  });

  it("给了 assetOrigin 时只放行这一处站内资源", () => {
    const origin = "https://mdocs.example.com";
    const csp = htmlPreviewCsp({ allowScripts: true, assetOrigin: origin });
    expect(csp).toContain(`img-src data: blob: ${origin}`);
    expect(csp).toContain(`media-src data: blob: ${origin}`);
    // 只用绝对 origin（opaque origin 下 'self' 不生效），且不得放开任意 host
    expect(csp).not.toContain("'self'");
    expect(csp).not.toContain("*");
  });

  it("预览文档把 CSP 放在 head 里、正文原样保留", () => {
    const doc = buildHtmlPreviewDocument("<p>hi</p>", { allowScripts: true });
    expect(doc.indexOf("Content-Security-Policy")).toBeGreaterThan(doc.indexOf("<head>"));
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(doc.indexOf("</head>"));
    expect(doc).toContain("<body><p>hi</p></body>");
  });

  it("识别内联脚本", () => {
    expect(hasInlineScript("<script>1</script>")).toBe(true);
    expect(hasInlineScript("<SCRIPT type=\"module\">")).toBe(true);
    expect(hasInlineScript("<p>no script</p>")).toBe(false);
  });
});
