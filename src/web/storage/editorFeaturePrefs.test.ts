import { describe, expect, it, beforeEach } from "vitest";
import {
  loadSelectAllSkipLeadingH1,
  saveSelectAllSkipLeadingH1,
  EDITOR_FEATURE_TOGGLES,
} from "./editorFeaturePrefs";

describe("editorFeaturePrefs", () => {
  beforeEach(() => {
    localStorage.removeItem("mdocs.features.selectAllSkipLeadingH1");
  });

  it("defaults select-all skip h1 to on", () => {
    expect(loadSelectAllSkipLeadingH1()).toBe(true);
  });

  it("persists toggle", () => {
    saveSelectAllSkipLeadingH1(false);
    expect(loadSelectAllSkipLeadingH1()).toBe(false);
    saveSelectAllSkipLeadingH1(true);
    expect(loadSelectAllSkipLeadingH1()).toBe(true);
  });

  it("registers at least one feature toggle", () => {
    expect(EDITOR_FEATURE_TOGGLES.some((f) => f.id === "selectAllSkipLeadingH1")).toBe(true);
  });
});
