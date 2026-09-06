import { describe, expect, it } from "vitest";
import { isAllowedAssetUpload } from "./assets.routes.js";

describe("isAllowedAssetUpload", () => {
  it("allows pdf / txt / md / csv / html", () => {
    expect(isAllowedAssetUpload("a.pdf", "application/pdf")).toBe(true);
    expect(isAllowedAssetUpload("a.pdf", "application/x-pdf")).toBe(true);
    expect(isAllowedAssetUpload("note.txt", "text/plain")).toBe(true);
    expect(isAllowedAssetUpload("readme.md", "text/markdown")).toBe(true);
    expect(isAllowedAssetUpload("data.csv", "text/csv")).toBe(true);
    expect(isAllowedAssetUpload("page.html", "text/html")).toBe(true);
    expect(isAllowedAssetUpload("page.htm", "text/html")).toBe(true);
  });

  it("allows empty mime and octet-stream for documents", () => {
    expect(isAllowedAssetUpload("a.pdf", "")).toBe(true);
    expect(isAllowedAssetUpload("a.txt", "application/octet-stream")).toBe(true);
  });

  it("keeps existing image / zip / audio", () => {
    expect(isAllowedAssetUpload("x.png", "image/png")).toBe(true);
    expect(isAllowedAssetUpload("p.zip", "application/zip")).toBe(true);
    expect(isAllowedAssetUpload("s.mp3", "audio/mpeg")).toBe(true);
  });

  it("rejects exe and mismatched mime", () => {
    expect(isAllowedAssetUpload("x.exe", "application/octet-stream")).toBe(false);
    expect(isAllowedAssetUpload("a.pdf", "image/png")).toBe(false);
    expect(isAllowedAssetUpload("a.txt", "audio/mpeg")).toBe(false);
  });
});
