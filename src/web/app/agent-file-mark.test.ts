import { describe, expect, it } from "vitest";
import { fileMarkKind, fileMarkLabel } from "./agent-file-mark";

describe("fileMarkKind", () => {
  it("按后缀和 mime 区分图片、pdf、markdown", () => {
    expect(fileMarkKind("截图.png", "image/png")).toBe("image");
    expect(fileMarkKind("notes.pdf", "application/pdf")).toBe("pdf");
    expect(fileMarkKind("readme.md", "text/markdown")).toBe("md");
    expect(fileMarkKind("data.csv")).toBe("csv");
    expect(fileMarkKind("pack.json", "application/json")).toBe("json");
    expect(fileMarkKind("book.xlsx")).toBe("xlsx");
    expect(fileMarkKind("legacy.xls")).toBe("xlsx");
  });

  it("类型标记用短标签", () => {
    expect(fileMarkLabel("pdf")).toBe("PDF");
    expect(fileMarkLabel("md")).toBe("MD");
    expect(fileMarkLabel("xlsx")).toBe("XLS");
  });
});