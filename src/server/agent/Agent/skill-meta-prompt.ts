/**
 * 注入 system 的私人 skill 目录（仅 name + description，无 body）。
 */
import { listUserSkills } from "./user-skills.js";

const META_MAX = 50;

export function buildSkillMetaSection(visitorId: string): string {
  const id = visitorId.trim();
  if (!id) return "";
  const all = listUserSkills(id);
  const skills = all.slice(0, META_MAX);
  if (skills.length === 0) {
    return [
      "## 私人 Skill 目录",
      "",
      "当前访客尚无私人 Skill。需要时可 create_user_skill，或请用户在输入框点选。",
    ].join("\n");
  }
  const lines = [
    "## 私人 Skill 目录（仅元信息，无正文）",
    "",
    "下列为可引用的 Skill 名称；全文需用户点选本轮 skill，或你调用 get_user_skill(name)。",
    "",
  ];
  for (const s of skills) {
    const desc = s.description.trim() || "（无简介）";
    lines.push(`- \`${s.name}\`: ${desc}`);
  }
  if (all.length > META_MAX) {
    lines.push("", `（仅列出最近 ${META_MAX} 条；更多用 list_user_skills。）`);
  }
  return lines.join("\n");
}
