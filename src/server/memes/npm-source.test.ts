import { describe, expect, it } from "vitest";
import { installMemePack, packNameOf } from "./npm-source.js";

describe("packNameOf", () => {
  it("普通包名与 dist-tag", () => {
    expect(packNameOf("mdocs-memes")).toBe("mdocs-memes");
    expect(packNameOf("mdocs-memes@latest")).toBe("mdocs-memes");
    expect(packNameOf("mdocs-memes@1.3.0")).toBe("mdocs-memes");
    expect(packNameOf("  mdocs-memes@^1.0.0  ")).toBe("mdocs-memes");
  });

  it("作用域包不把 @ 当版本分隔", () => {
    expect(packNameOf("@scope/memes")).toBe("@scope/memes");
    expect(packNameOf("@scope/memes@latest")).toBe("@scope/memes");
  });

  it("非法 spec 返回 null", () => {
    expect(packNameOf("")).toBeNull();
    expect(packNameOf("   ")).toBeNull();
    expect(packNameOf("../../etc/passwd")).toBeNull();
    expect(packNameOf("a".repeat(300))).toBeNull();
  });
});

describe("installMemePack 入参校验（不触网）", () => {
  it("空 spec 直接报错", async () => {
    await expect(installMemePack("  ")).rejects.toThrow(/缺少 npm 包名/);
  });

  it("registry 必须是 http(s)", async () => {
    await expect(installMemePack("mdocs-memes", { registry: "ftp://x" })).rejects.toThrow(
      /registry 必须是 http\(s\) 地址/,
    );
  });
});
