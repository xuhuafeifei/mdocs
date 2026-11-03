import { describe, expect, it } from "vitest";
import { DocPathError } from "./docPath.js";
import {
  normalisePathSegmentForStorage,
  normaliseRelativePathForStorage,
} from "./storagePath.js";

describe("normalisePathSegmentForStorage", () => {
  it("keeps a hyphen inside a directory name", () => {
    expect(normalisePathSegmentForStorage("设计-草案")).toBe("设计-草案");
    expect(normalisePathSegmentForStorage("my-notes")).toBe("my-notes");
  });

  it("rejects a segment that is only hyphens", () => {
    expect(normalisePathSegmentForStorage("-")).toBe("");
    expect(normalisePathSegmentForStorage("--")).toBe("");
    expect(() => normaliseRelativePathForStorage("-/note.md")).toThrow(DocPathError);
  });
});
