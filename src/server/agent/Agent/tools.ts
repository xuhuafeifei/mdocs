import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { SkillLoader } from "../Skill/skill-loader.js";

export function createSkillTools(skills: SkillLoader): AgentTool[] {
  return [
    {
      name: "mdocs_manual_outline",
      label: "查询 mdocs 手册大纲",
      description:
        "列出 mdocs 用户手册各章节元数据（id / name / description），用于选择要阅读的章节",
      parameters: Type.Object({}),
      execute: async () => ({
        content: [{ type: "text", text: JSON.stringify(skills.list(), null, 2) }],
        details: {},
      }),
    },
    {
      name: "mdocs_manual_content",
      label: "查询 mdocs 手册正文",
      description: "按 id 读取 mdocs 用户手册某一章节的完整正文",
      parameters: Type.Object({
        id: Type.String({ description: "章节 id，来自「查询 mdocs 手册大纲」" }),
      }),
      execute: async (_id, params) => {
        const id = (params as { id: string }).id;
        const body = skills.read(id);
        if (!body) throw new Error(`手册章节不存在: ${id}，请先调用「查询 mdocs 手册大纲」`);
        return {
          content: [{ type: "text", text: body.content }],
          details: { id: body.id },
        };
      },
    },
  ];
}
