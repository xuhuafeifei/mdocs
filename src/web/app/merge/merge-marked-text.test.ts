import { describe, expect, it } from "vitest";
import {
  serializeMergeMarkedText,
  stillHasGitConflictMarkers,
  unwrapMarkdownFence,
} from "./merge-marked-text";
import type { MergeSegment } from "./merge-plan";

describe("serializeMergeMarkedText", () => {
  it("keeps unchanged text and uses classic git conflict markers", () => {
    const segments: MergeSegment[] = [
      { kind: "unchanged", lines: ["# title", "", "intro"] },
      {
        kind: "conflict",
        id: "conflict-0",
        conflictKind: "true_conflict",
        baseLines: ["old"],
        localLines: ["mine"],
        remoteLines: ["theirs"],
        resolution: "unresolved",
      },
      { kind: "unchanged", lines: ["tail"] },
    ];
    const { conflictMarkdown, unresolvedCount } = serializeMergeMarkedText(segments);
    expect(unresolvedCount).toBe(1);
    expect(conflictMarkdown).toContain("# title");
    expect(conflictMarkdown).toContain("intro");
    expect(conflictMarkdown).toContain("<<<<<<< local");
    expect(conflictMarkdown).toContain("mine");
    expect(conflictMarkdown).toContain("=======");
    expect(conflictMarkdown).toContain("theirs");
    expect(conflictMarkdown).toContain(">>>>>>> remote");
    expect(conflictMarkdown).toContain("||||||| base");
    expect(conflictMarkdown).toContain("tail");
  });

  it("emits resolved conflict as plain text", () => {
    const segments: MergeSegment[] = [
      {
        kind: "conflict",
        id: "conflict-0",
        conflictKind: "change",
        baseLines: [],
        localLines: ["L"],
        remoteLines: ["R"],
        resolution: "remote",
      },
    ];
    const { conflictMarkdown, unresolvedCount } = serializeMergeMarkedText(segments);
    expect(unresolvedCount).toBe(0);
    expect(conflictMarkdown).toBe("R");
    expect(conflictMarkdown).not.toContain("<<<<<<<");
  });
});

describe("unwrapMarkdownFence / stillHasGitConflictMarkers", () => {
  it("unwraps fence", () => {
    expect(unwrapMarkdownFence("```md\nhello\n```")).toBe("hello");
  });

  it("detects leftover markers", () => {
    expect(stillHasGitConflictMarkers("ok\n<<<<<<< local\nx\n=======\ny\n>>>>>>> remote\n")).toBe(
      true,
    );
    expect(stillHasGitConflictMarkers("clean text")).toBe(false);
  });
});
