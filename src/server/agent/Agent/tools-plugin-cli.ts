/**
 * 插件 CLI / Skill 查询：路径前缀由系统解析，Agent 只交相对路径。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  listPluginHomeFiles,
  PLUGIN_CLI_COMMANDS,
  runPluginCli,
} from "../../plugins/plugin-cli.js";
import { pluginHomeDir } from "../../plugins/plugin-paths.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";
import { getUserSkillByName, listUserSkills } from "./user-skills.js";

export function querySkillTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "query_skill",
    label: "查询私人 Skill",
    description:
      "按 name 查询当前访客私人 Skill（description / body / updatedAt）。与 upsert_skill 写入的目录对应。不传 name 则列出摘要（无正文）。需要跑插件脚本时再用 run_plugin_cli（相对 plugins-home）。",
    parameters: Type.Object({
      name: Type.Optional(
        Type.String({ description: "Skill 名称；省略则列出全部摘要" }),
      ),
    }),
    execute: async (_id, params) => {
      const name = String((params as { name?: string }).name ?? "").trim();
      if (!name) {
        const skills = listUserSkills(visitorId).map((s) => ({
          name: s.name,
          description: s.description,
          updatedAt: s.updatedAt,
          bodyChars: s.body.length,
        }));
        return asToolResult({ ok: true, count: skills.length, skills });
      }
      const skill = getUserSkillByName(visitorId, name);
      if (!skill) {
        return asToolResult({ ok: false, error: "skill_not_found", name });
      }
      return asToolResult({ ok: true, skill });
    },
  };
}

export function listPluginHomeTool(_deps: ToolDeps): AgentTool {
  return {
    name: "list_plugin_home",
    label: "列出插件安装目录",
    description:
      "列出 plugins-home/<plugin_name>/ 下文件（相对路径）。装完或 clone 后可用此工具确认脚本是否在，再 run_plugin_cli 试跑。",
    parameters: Type.Object({
      plugin_name: Type.String({
        description: "插件名（与流水线 id / plugins-home 目录名一致）",
      }),
      path: Type.Optional(
        Type.String({ description: "相对子目录；默认根；禁止绝对路径" }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as { plugin_name?: string; path?: string };
      const pluginName = String(p.plugin_name ?? "").trim();
      if (!pluginName) {
        return asToolResult({ ok: false, error: "plugin_name required" });
      }
      try {
        const listed = listPluginHomeFiles(pluginName, p.path ?? ".");
        return asToolResult({
          ok: true,
          plugin_name: pluginName,
          home: listed.root,
          exists: listed.entries.length > 0 || listed.root.length > 0,
          entries: listed.entries,
        });
      } catch (err) {
        return asToolResult({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

export function runPluginCliTool(deps: ToolDeps): AgentTool {
  return {
    name: "run_plugin_cli",
    label: "运行插件 CLI",
    description:
      "在 plugins-home/<plugin_name>/（或 cwd_root=data 时在租户 plugins-data）执行白名单命令以自测/配置。命令仅允许：" +
      PLUGIN_CLI_COMMANDS.join(", ") +
      "。args 与 cwd 必须是相对路径，禁止绝对路径、~、..。例：command=python3 args=[\"scripts/ddwiki.py\",\"--help\"]。装完后应用 list_plugin_home 确认文件再试跑。",
    parameters: Type.Object({
      plugin_name: Type.String({ description: "插件名" }),
      command: Type.String({
        description: "白名单命令名，如 python3 / node / npx",
      }),
      args: Type.Optional(
        Type.Array(Type.String(), {
          description: "参数数组；脚本路径写相对 home 的片段",
        }),
      ),
      cwd: Type.Optional(
        Type.String({ description: "相对 home/data 的子目录" }),
      ),
      cwd_root: Type.Optional(
        Type.Union([Type.Literal("home"), Type.Literal("data")], {
          description: "home=plugins-home（默认）；data=租户 plugins-data",
        }),
      ),
      timeout_seconds: Type.Optional(
        Type.Number({ description: "超时秒数，默认 30，最大 120" }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        plugin_name?: string;
        command?: string;
        args?: string[];
        cwd?: string;
        cwd_root?: "home" | "data";
        timeout_seconds?: number;
      };
      const pluginName = String(p.plugin_name ?? "").trim();
      if (!pluginName) {
        return asToolResult({ ok: false, error: "plugin_name required" });
      }
      try {
        const result = await runPluginCli({
          visitorId: deps.visitorId,
          pluginName,
          command: String(p.command ?? ""),
          args: p.args,
          cwd: p.cwd,
          cwdRoot: p.cwd_root === "data" ? "data" : "home",
          timeoutSeconds: p.timeout_seconds,
          signal: deps.signal,
        });
        return asToolResult({
          ok: result.ok,
          exitCode: result.exitCode,
          command: result.command,
          args: result.args,
          cwd: result.cwd,
          plugin_home: pluginHomeDir(pluginName),
          stdout: result.stdout,
          stderr: result.stderr,
          hint: result.ok
            ? undefined
            : "非零退出：检查相对路径、依赖是否已装、或改 cwd_root=data 写配置",
        });
      } catch (err) {
        return asToolResult({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

export function pluginCliTools(deps: ToolDeps): AgentTool[] {
  return [querySkillTool(deps), listPluginHomeTool(deps), runPluginCliTool(deps)];
}
