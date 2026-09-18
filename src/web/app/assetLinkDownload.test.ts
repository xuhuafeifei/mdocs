import { describe, expect, it } from "vitest";
import { assetDownloadTarget } from "./assetLinkDownload";

const page = "http://127.0.0.1:4000/#/doc/abc";

describe("assetDownloadTarget", () => {
  it("rewrites same-origin file assets and keeps the original name", () => {
    const target = assetDownloadTarget(
      "/api/assets/11111111-1111-4111-8111-111111111111.pdf",
      "季度报告.pdf",
      page,
    );
    expect(target).toContain("/api/assets/");
    expect(target).toContain("name=");
    expect(decodeURIComponent(target!)).toContain("季度报告.pdf");
  });

  it("leaves images and external links alone", () => {
    expect(assetDownloadTarget("/api/assets/a.png", "a.png", page)).toBeNull();
    expect(assetDownloadTarget("https://example.com/a.pdf", "a.pdf", page)).toBeNull();
  });
});
