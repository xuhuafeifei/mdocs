import { describe, expect, it } from "vitest";
import { isAllowedAssetUpload, buildAssetResponseHeaders } from "./assets.routes.js";

describe("isAllowedAssetUpload", () => {
  it("allows any file type (no restrictions)", () => {
    expect(isAllowedAssetUpload("a.pdf", "application/pdf")).toBe(true);
    expect(isAllowedAssetUpload("a.pdf", "application/x-pdf")).toBe(true);
    expect(isAllowedAssetUpload("note.txt", "text/plain")).toBe(true);
    expect(isAllowedAssetUpload("readme.md", "text/markdown")).toBe(true);
    expect(isAllowedAssetUpload("data.csv", "text/csv")).toBe(true);
    expect(isAllowedAssetUpload("page.html", "text/html")).toBe(true);
    expect(isAllowedAssetUpload("page.htm", "text/html")).toBe(true);
  });

  it("allows empty mime and octet-stream", () => {
    expect(isAllowedAssetUpload("a.pdf", "")).toBe(true);
    expect(isAllowedAssetUpload("a.txt", "application/octet-stream")).toBe(true);
  });

  it("allows everything including unknown types", () => {
    expect(isAllowedAssetUpload("x.png", "image/png")).toBe(true);
    expect(isAllowedAssetUpload("p.zip", "application/zip")).toBe(true);
    expect(isAllowedAssetUpload("s.mp3", "audio/mpeg")).toBe(true);
    expect(isAllowedAssetUpload("x.exe", "application/octet-stream")).toBe(true);
    expect(isAllowedAssetUpload("a.pdf", "image/png")).toBe(true);
    expect(isAllowedAssetUpload("a.txt", "audio/mpeg")).toBe(true);
    expect(isAllowedAssetUpload("archive.7z", "application/x-7z-compressed")).toBe(true);
    expect(isAllowedAssetUpload("script.js", "text/javascript")).toBe(true);
    expect(isAllowedAssetUpload("data.json", "application/json")).toBe(true);
  });
});

describe("buildAssetResponseHeaders", () => {
  it("forces attachment for non-images and keeps images inline", () => {
    const pdf = buildAssetResponseHeaders(".pdf", "id.pdf", "报告.pdf");
    expect(pdf.contentType).toBe("application/pdf");
    expect(pdf.contentDisposition).toContain("attachment");
    expect(pdf.contentDisposition).toContain("filename*=UTF-8''");

    const png = buildAssetResponseHeaders(".png", "id.png");
    expect(png.contentType).toBe("image/png");
    expect(png.contentDisposition).toBeUndefined();

    const html = buildAssetResponseHeaders(".html", "id.html");
    expect(html.contentType).toBe("application/octet-stream");
    expect(html.contentDisposition).toContain("attachment");
  });

  it("strips path and header characters from the download name", () => {
    const headers = buildAssetResponseHeaders(".zip", "id.zip", "../evil\r\n.zip");
    expect(headers.contentDisposition).toContain('filename="evil.zip"');
    expect(headers.contentDisposition).not.toContain("\r");
    const fallback = buildAssetResponseHeaders(".zip", "id.zip", "..");
    expect(fallback.contentDisposition).toContain('filename="id.zip"');
  });
});
