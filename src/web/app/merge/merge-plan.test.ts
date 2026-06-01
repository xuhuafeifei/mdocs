import { describe, expect, it } from "vitest";
import {
  assembleMergedMarkdown,
  buildThreeWayMergePlan,
  conflictPlaceholderLine,
  countUnresolvedConflicts,
  isConflictPlaceholderLine,
  updateConflictResolution,
} from "./merge-plan.js";

describe("buildThreeWayMergePlan", () => {
  it("marks one-sided edits as conflicts instead of silent auto-merge", () => {
    const base = "a\nbase\nb";
    const local = "a\nlocal\nb";
    const remote = "a\nbase\nb";
    const plan = buildThreeWayMergePlan(local, base, remote);
    expect(plan).toHaveLength(3);
    expect(plan[0]).toEqual({ kind: "unchanged", lines: ["a"] });
    expect(plan[1]).toMatchObject({
      kind: "conflict",
      conflictKind: "change",
      baseLines: ["base"],
      localLines: ["local"],
      remoteLines: ["base"],
      resolution: "unresolved",
    });
    expect(plan[2]).toEqual({ kind: "unchanged", lines: ["b"] });
    expect(countUnresolvedConflicts(plan)).toBe(1);
    const assembled = assembleMergedMarkdown(plan);
    expect(assembled).toContain(conflictPlaceholderLine("conflict-0"));
  });

  it("marks true conflict with placeholder until resolved", () => {
    const plan = buildThreeWayMergePlan(
      "a\nlocal\nb",
      "a\nbase\nb",
      "a\nremote\nb",
    );
    expect(plan).toHaveLength(3);
    const conflict = plan[1];
    expect(conflict).toMatchObject({
      kind: "conflict",
      localLines: ["local"],
      remoteLines: ["remote"],
      baseLines: ["base"],
      resolution: "unresolved",
    });
    const assembled = assembleMergedMarkdown(plan);
    const placeholder = conflictPlaceholderLine("conflict-0");
    expect(assembled).toContain(placeholder);
    expect(isConflictPlaceholderLine(placeholder)).toBe("conflict-0");
  });

  it("assembles after resolution", () => {
    let plan = buildThreeWayMergePlan("x\ny", "x\nz", "x\nw");
    plan = updateConflictResolution(plan, "conflict-0", "remote");
    expect(assembleMergedMarkdown(plan)).toBe("x\nw");
    expect(countUnresolvedConflicts(plan)).toBe(0);
  });
});
