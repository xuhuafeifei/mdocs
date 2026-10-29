import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AssetUploadError, uploadAssetFiles } from "./asset-upload.js";

let root: string;
let assetsDir: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-asset-cli-"));
  assetsDir = path.join(root, "assets");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function writeFixture(name: string, content: string): string {
  const file = path.join(root, name);
  fs.writeFileSync(file, content);
  return file;
}

describe("uploadAssetFiles", () => {
  it("复制文件并按 uuid+ext 命名，返回站内可用的公开路径", () => {
    const file = writeFixture("logo.PNG", "png-bytes");
    const [asset] = uploadAssetFiles([file], { assetsDir, maxBytes: 1024 });

    expect(asset?.source).toBe(file);
    expect(asset?.publicPath).toMatch(/^\/api\/assets\/[0-9a-f-]{36}\.png$/);
    expect(asset?.bytes).toBe(9);
    expect(fs.existsSync(path.join(assetsDir, `${asset?.id}.png`))).toBe(true);
  });

  it("无扩展名落 .bin", () => {
    const file = writeFixture("blob", "x");
    const [asset] = uploadAssetFiles([file], { assetsDir, maxBytes: 1024 });
    expect(asset?.publicPath.endsWith(".bin")).toBe(true);
  });

  it("baseUrl 拼出绝对地址并去掉多余斜杠", () => {
    const file = writeFixture("a.png", "x");
    const [asset] = uploadAssetFiles([file], {
      assetsDir,
      maxBytes: 1024,
      baseUrl: "http://localhost:4000/",
    });
    expect(asset?.url).toBe(`http://localhost:4000${asset?.publicPath}`);
  });

  it("超过大小上限直接拒绝，且不落盘", () => {
    const file = writeFixture("big.png", "0123456789");
    expect(() => uploadAssetFiles([file], { assetsDir, maxBytes: 4 })).toThrow(AssetUploadError);
    expect(fs.existsSync(assetsDir)).toBe(false);
  });

  it("文件不存在报错；多个文件全部成功", () => {
    expect(() => uploadAssetFiles([path.join(root, "missing.png")], { assetsDir, maxBytes: 1024 })).toThrow(
      /file not found/,
    );

    const a = writeFixture("a.png", "aaa");
    const b = writeFixture("b.svg", "<svg/>");
    const assets = uploadAssetFiles([a, b], { assetsDir, maxBytes: 1024 });
    expect(assets).toHaveLength(2);
    expect(assets[1]?.publicPath.endsWith(".svg")).toBe(true);
  });

  it("没有文件时报错", () => {
    expect(() => uploadAssetFiles([], { assetsDir, maxBytes: 1024 })).toThrow(/no files/);
  });
});
