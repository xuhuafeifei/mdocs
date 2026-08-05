import { describe, it, expect } from "vitest";
import type { SkillLoader } from "../Skill/skill-loader.js";
import { createToolsForMode } from "./tools-registry.js";
import type { ToolDeps } from "./tool-deps.js";

const STRUCTURE_NAMES = [
  "list_visitors",
  "list_domains",
  "create_domain",
  "list_domain_members",
  "add_domain_members",
  "search_documents",
  "list_tree",
  "list_my_documents",
  "get_document",
  "create_document",
  "create_folder",
  "move_document",
] as const;

const MANUAL_NAMES = ["mdocs_manual_outline", "mdocs_manual_content"] as const;

const stubSkills = {
  isReady: () => true,
  list: () => [],
  read: () => null,
} as unknown as SkillLoader;

const baseDeps: ToolDeps = {
  visitorId: "v-test",
  onEvent: () => {},
};

describe("createToolsForMode", () => {
  it("normal without skills: account + choice + overwrite", () => {
    expect(
      createToolsForMode("normal", baseDeps).map((t) => t.name),
    ).toEqual([
      ...STRUCTURE_NAMES,
      "ask_user_choice",
      "overwrite_document",
    ]);
  });

  it("normal Ask: manual + account + choice + overwrite", () => {
    expect(
      createToolsForMode("normal", {
        ...baseDeps,
        skills: stubSkills,
      }).map((t) => t.name),
    ).toEqual([
      ...MANUAL_NAMES,
      ...STRUCTURE_NAMES,
      "ask_user_choice",
      "overwrite_document",
    ]);
  });

  it("coding: manual + account + choice + coding_write, no overwrite", () => {
    expect(
      createToolsForMode("coding", {
        ...baseDeps,
        skills: stubSkills,
        coding: {
          documentId: "d1",
          workingMarkdown: "",
          baseMarkdown: "",
        },
      }).map((t) => t.name),
    ).toEqual([
      ...MANUAL_NAMES,
      ...STRUCTURE_NAMES,
      "ask_user_choice",
      "get_working_document",
      "set_markdown_document",
    ]);
  });

  it("coding without coding ctx throws", () => {
    expect(() => createToolsForMode("coding", baseDeps)).toThrow(/coding ctx/);
  });
});
