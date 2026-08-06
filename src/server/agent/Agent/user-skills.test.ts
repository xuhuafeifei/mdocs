import { describe, expect, it } from "vitest";
import {
  formatSkillExpandBlock,
  normalizeName,
  normalizeSkillRefs,
  USER_SKILL_REF_MAX,
} from "./user-skills.js";
import {
  expandUserMessageForPi,
  markSkillExpandPoints,
} from "./hydrate-messages.js";

describe("normalizeSkillRefs", () => {
  it("dedupes, trims, and caps", () => {
    const ids = Array.from({ length: USER_SKILL_REF_MAX + 3 }, (_, i) => ` id-${i} `);
    const out = normalizeSkillRefs([...ids, "id-0", 1, null]);
    expect(out).toHaveLength(USER_SKILL_REF_MAX);
    expect(out[0]).toBe("id-0");
  });

  it("returns empty for non-array", () => {
    expect(normalizeSkillRefs(undefined)).toEqual([]);
    expect(normalizeSkillRefs("x")).toEqual([]);
  });
});

describe("normalizeName", () => {
  it("accepts english digits underscore", () => {
    expect(normalizeName(" My_Skill1 ")).toBe("My_Skill1");
  });

  it("rejects non-ascii or symbols", () => {
    expect(() => normalizeName("周报")).toThrow("skill_name_invalid");
    expect(() => normalizeName("bad-name")).toThrow("skill_name_invalid");
    expect(() => normalizeName("a b")).toThrow("skill_name_invalid");
  });
});

describe("formatSkillExpandBlock", () => {
  it("wraps body without path", () => {
    const s = formatSkillExpandBlock('a"b', "My <Skill>", "hello");
    expect(s).toContain('<skill id="a&quot;b" name="My &lt;Skill&gt;">');
    expect(s).toContain("hello");
    expect(s).not.toContain("location=");
  });
});

describe("markSkillExpandPoints", () => {
  it("picks newest turn for each skill name", () => {
    const map = markSkillExpandPoints([
      { role: "user", content: "a", skillNames: ["s1", "s2"] },
      { role: "assistant", content: "ok" },
      { role: "user", content: "b", skillNames: ["s1"] },
      { role: "user", content: "c", skillNames: ["s3"] },
    ]);
    expect(map.get("s1")).toBe(2);
    expect(map.get("s2")).toBe(0);
    expect(map.get("s3")).toBe(3);
  });
});

describe("expandUserMessageForPi", () => {
  it("keeps original content when no skills", () => {
    const msgs = expandUserMessageForPi("v1", "帮我写周报", [], 1);
    expect(msgs).toEqual([{ role: "user", content: "帮我写周报", timestamp: 1 }]);
  });
});
