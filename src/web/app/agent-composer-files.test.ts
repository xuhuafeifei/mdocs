import { describe, expect, it } from "vitest";
import { ensureUploadFileName, filesFromDataTransfer, nameFilesForUpload } from "./agent-composer-files";

describe("ensureUploadFileName", () => {
  it("keeps a named file", () => {
    const file = new File(["x"], "截图.png", { type: "image/png" });
    expect(ensureUploadFileName(file)).toBe(file);
  });

  it("names a clipboard screenshot that has no filename", () => {
    const file = new File(["x"], "", { type: "image/png" });
    const named = ensureUploadFileName(file, new Date(2026, 9, 14, 18, 5, 9));
    expect(named.name).toBe("paste-180509.png");
    expect(named.type).toBe("image/png");
  });
});

describe("nameFilesForUpload", () => {
  it("keeps the first image.png and suffixes the next ones", () => {
    const files = [
      new File(["a"], "image.png", { type: "image/png" }),
      new File(["b"], "image.png", { type: "image/png" }),
      new File(["c"], "image.png", { type: "image/png" }),
    ];
    expect(nameFilesForUpload(files, ["image_1.png"]).map((f) => f.name)).toEqual([
      "image.png",
      "image_2.png",
      "image_3.png",
    ]);
  });
});

describe("filesFromDataTransfer", () => {
  it("returns nothing when there is no transfer", () => {
    expect(filesFromDataTransfer(null)).toEqual([]);
  });
});
