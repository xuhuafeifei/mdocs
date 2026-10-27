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
  "set_domain_permission",
  "search_documents",
  "list_tree",
  "query_my_documents",
  "list_semantic_index",
  "rebuild_semantic_index",
  "invite_document_user",
  "get_document",
  "create_document",
  "create_folder",
  "move_document",
  "rename_document",
  "sheet_get_schema",
  "sheet_list_rows",
  "sheet_get_styles",
  "sheet_set_cells",
  "sheet_update_row",
  "sheet_append_rows",
  "sheet_insert_rows_at",
  "sheet_overwrite",
  "sheet_rename_column",
  "sheet_delete_rows",
  "sheet_delete_columns",
  "sheet_set_cell_style",
  "sheet_merge_cells",
  "sheet_unmerge_cells",
  "sheet_add_sheet",
  "sheet_rename_sheet",
  "sheet_delete_sheet",
] as const;

const MANUAL_NAMES = ["mdocs_manual_outline", "mdocs_manual_content"] as const;

const UTILITY_NAMES = ["get_now", "set_thinking_level", "read_attachment"] as const;

/** 用户自建 skill 的增删改查：两种 mode 都无条件注册（与 SkillLoader 无关） */
const USER_SKILL_NAMES = [
  "list_user_skills",
  "get_user_skill",
  "create_user_skill",
  "update_user_skill",
  "delete_user_skill",
] as const;

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
      ...UTILITY_NAMES,
      ...STRUCTURE_NAMES,
      "ask_user_choice",
      "overwrite_document",
      "append_document",
      "replace_document_markdown",
      "get_editor_draft",
      "suggest_document_merge",
      "suggest_document_merge_message",
      "get_document_lexical_lines",
      "set_document_lexical_lines",
      ...USER_SKILL_NAMES,
    ]);
  });

  it("kind=deepseek 时挂载 web_search / web_fetch", () => {
    const names = createToolsForMode("normal", {
      ...baseDeps,
      deepseekWeb: { apiKey: "sk-test" },
    }).map((t) => t.name);
    expect(names).toContain("web_search");
    expect(names).toContain("web_fetch");
    expect(names.indexOf("web_search")).toBeGreaterThan(
      names.indexOf("read_attachment"),
    );
  });

  it("normal Ask: manual + account + choice + overwrite", () => {
    expect(
      createToolsForMode("normal", {
        ...baseDeps,
        skills: stubSkills,
      }).map((t) => t.name),
    ).toEqual([
      ...MANUAL_NAMES,
      ...UTILITY_NAMES,
      ...STRUCTURE_NAMES,
      "ask_user_choice",
      "overwrite_document",
      "append_document",
      "replace_document_markdown",
      "get_editor_draft",
      "suggest_document_merge",
      "suggest_document_merge_message",
      "get_document_lexical_lines",
      "set_document_lexical_lines",
      ...USER_SKILL_NAMES,
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
      ...UTILITY_NAMES,
      ...STRUCTURE_NAMES,
      "ask_user_choice",
      "get_working_document",
      "set_markdown_document",
      ...USER_SKILL_NAMES,
    ]);
  });

  it("coding without coding ctx throws", () => {
    expect(() => createToolsForMode("coding", baseDeps)).toThrow(/coding ctx/);
  });
});
