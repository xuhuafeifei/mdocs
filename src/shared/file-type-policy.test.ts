import { describe, expect, it } from "vitest";
import { FILE_TYPE } from "./file-types.js";
import {
  ftsIndexTypes,
  getPolicy,
  graphWalkIncludeTypes,
  isVisibleFileType,
  movableDocTypes,
  treeIncludeTypes,
} from "./file-type-policy.js";

describe("file-type-policy", () => {
  it("html：可见、可移动、不进 FTS/图谱；aiWrite + comments 开", () => {
    const p = getPolicy(FILE_TYPE.HTML);
    expect(p.treeVisible).toBe(true);
    expect(p.movable).toBe(true);
    expect(p.ftsIndex).toBe(false);
    expect(p.graphExtract).toBe(false);
    expect(p.pathExt).toBe(".html");
    expect(p.textExtract).toBe("raw");
    expect(p.draftKind).toBe("html");
    expect(p.mergePipeline).toBe("raw-text");
    expect(p.aiWrite).toBe(true);
    expect(p.comments).toBe(true);
    expect((p as { editor?: unknown }).editor).toBeUndefined();
  });

  it("md：aiWrite + comments 开", () => {
    const p = getPolicy(FILE_TYPE.DOCUMENT);
    expect(p.aiWrite).toBe(true);
    expect(p.comments).toBe(true);
    expect((p as { editor?: unknown }).editor).toBeUndefined();
  });

  it("派生查询不含 html 进 FTS / graph walk", () => {
    expect(ftsIndexTypes()).toEqual([FILE_TYPE.DOCUMENT]);
    expect(graphWalkIncludeTypes()).toEqual([
      FILE_TYPE.DOCUMENT,
      FILE_TYPE.FOLDER,
      FILE_TYPE.FOLDER_DESC,
    ]);
    expect(treeIncludeTypes()).toContain(FILE_TYPE.HTML);
    expect(movableDocTypes()).toEqual([FILE_TYPE.DOCUMENT, FILE_TYPE.HTML]);
  });

  it("isVisibleFileType 读 treeVisible", () => {
    expect(isVisibleFileType(FILE_TYPE.DOCUMENT)).toBe(true);
    expect(isVisibleFileType(FILE_TYPE.HTML)).toBe(true);
    expect(isVisibleFileType(FILE_TYPE.FOLDER)).toBe(true);
    expect(isVisibleFileType(FILE_TYPE.FOLDER_DESC)).toBe(false);
  });
});
