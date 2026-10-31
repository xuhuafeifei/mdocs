/**
 * plugin-pipeline 模式专用工具：临时工作区探测 + submit/install。
 * ask_user_choice 走 choiceTools，不在此重复注册。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { parse as parseYaml } from "yaml";
import { getVisitorAgentConfig } from "../Config/config.js";
import { writePipelineYaml } from "../../plugins/pipeline/catalog.js";
import { normalizeDraftYaml } from "../../plugins/pipeline/draft-normalize.js";
import { parsePipelineYaml } from "../../plugins/pipeline/parse.js";
import {
  executePipelineAiTool,
  type PipelineAiToolContext,
} from "../../plugins/pipeline/pipeline-ai-tools.js";
import {
  startPipelineJob,
  waitForPipelineJob,
  type PipelineJob,
} from "../../plugins/pipeline-job.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

function jobPublic(job: PipelineJob) {
  return {
    id: job.id,
    pipelineId: job.pipelineId,
    pipelineName: job.pipelineName,
    scope: job.scope,
    action: job.action,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
    steps: job.steps.map((s) => ({
      index: s.index,
      type: s.type,
      label: s.label,
      status: s.status,
      ...(s.detail ? { detail: s.detail } : {}),
      ...(s.error ? { error: s.error } : {}),
    })),
    logs: job.logs.slice(-80).map((l) => ({
      ts: l.ts,
      level: l.level,
      line: l.line,
      ...(l.stepIndex != null ? { stepIndex: l.stepIndex } : {}),
    })),
  };
}

function requirePipeline(deps: ToolDeps): NonNullable<ToolDeps["pipeline"]> {
  if (!deps.pipeline) throw new Error("pipeline ctx required");
  return deps.pipeline;
}

function toCtx(deps: ToolDeps): PipelineAiToolContext {
  const p = requirePipeline(deps);
  return {
    workspace: p.workspace,
    deadline: p.deadline,
    trace: p.trace,
    ...(p.expectedId ? { expectedId: p.expectedId } : {}),
    ...(p.expectedKind ? { expectedKind: p.expectedKind } : {}),
    ...(deps.signal ? { signal: deps.signal } : {}),
  };
}

async function runNamed(
  deps: ToolDeps,
  name: string,
  params: unknown,
) {
  const result = await executePipelineAiTool(toCtx(deps), name, params);
  if (!result.ok) {
    return asToolResult({ ok: false, error: result.text });
  }
  try {
    return asToolResult({ ok: true, ...(JSON.parse(result.text) as object) });
  } catch {
    return asToolResult({ ok: true, text: result.text });
  }
}

export function pipelineProbeTools(deps: ToolDeps): AgentTool[] {
  return [
    {
      name: "exec",
      label: "执行探测命令",
      description:
        "在临时工作区执行命令（不经 shell），仅轻量探测：如 --version、tar -tzf。禁止 git clone、npm/pip/brew install、任何安装或写入用户目录。真正的拉包/克隆写进 pipeline.yaml 的步骤，由用户点安装后执行。",
      parameters: Type.Object({
        command: Type.String({ description: "可执行文件，例如 npx、tar、node" }),
        args: Type.Optional(
          Type.Array(Type.String(), { description: "参数数组，不拼 shell" }),
        ),
        cwd: Type.Optional(
          Type.String({ description: "相对临时工作区的目录；默认工作区根" }),
        ),
        timeout_seconds: Type.Optional(
          Type.Number({ description: "1-30 秒，默认 15" }),
        ),
      }),
      execute: async (_id, params) => runNamed(deps, "exec", params),
    },
    {
      name: "download",
      label: "下载公开文件",
      description:
        "仅当必须确认公开包结构时，临时下载到工作区查看（最多 50MB）。正常安装拉包应写进 YAML 的 download 步骤，不要替流水线预拉或 clone。",
      parameters: Type.Object({
        url: Type.String({ description: "公开 http(s) URL" }),
        filename: Type.Optional(Type.String({ description: "可选保存文件名" })),
      }),
      execute: async (_id, params) => runNamed(deps, "download", params),
    },
    {
      name: "fetch_page",
      label: "抓取网页",
      description:
        "抓取一个公开网页并转成纯文本（最多约 12k 字符）。用于阅读 README、release 说明、MCP 文档。",
      parameters: Type.Object({
        url: Type.String({ description: "公开 http(s) URL" }),
      }),
      execute: async (_id, params) => runNamed(deps, "fetch_page", params),
    },
    {
      name: "list_dir",
      label: "列出工作区目录",
      description: "列出临时工作区（或其中子目录）的文件。",
      parameters: Type.Object({
        path: Type.Optional(
          Type.String({ description: "相对工作区的目录；默认根" }),
        ),
      }),
      execute: async (_id, params) => runNamed(deps, "list_dir", params),
    },
    {
      name: "read_file",
      label: "读取工作区文件",
      description:
        "读取临时工作区内的文本文件（最多 20k 字符）。可用于查看下载包里的 README / 配置，不要读二进制。",
      parameters: Type.Object({
        path: Type.String({ description: "相对工作区的文件路径" }),
        max_chars: Type.Optional(
          Type.Number({ description: "最多读取字符数，默认 8000" }),
        ),
      }),
      execute: async (_id, params) => runNamed(deps, "read_file", params),
    },
  ];
}

export function submitPipelineTool(deps: ToolDeps): AgentTool {
  return {
    name: "submit_pipeline",
    label: "提交流水线草稿",
    description:
      "提交 pipeline.yaml 草稿（右侧节点更新）。校验通过后应再调用 install_pipeline 真正安装到 plugins-home；不要自己 git clone。",
    parameters: Type.Object({
      yaml: Type.String({ description: "完整 YAML 文本，不要 markdown 围栏" }),
      notes: Type.Optional(
        Type.String({ description: "可选：给用户的简短说明（安装方式 / 风险）" }),
      ),
    }),
    execute: async (_id, params) => {
      const p = requirePipeline(deps);
      const raw = params as { yaml?: string; notes?: string };
      const result = await executePipelineAiTool(toCtx(deps), "submit_pipeline", params);
      if (!result.ok || !result.submittedYaml) {
        return asToolResult({ ok: false, error: result.text });
      }

      const yaml = normalizeDraftYaml(result.submittedYaml, p.currentYaml);
      let valid = true;
      let error: string | undefined;
      try {
        parsePipelineYaml(yaml);
      } catch (err) {
        valid = false;
        error = err instanceof Error ? err.message : String(err);
      }

      const notes =
        typeof raw.notes === "string" && raw.notes.trim()
          ? raw.notes.trim()
          : undefined;
      const cfg = getVisitorAgentConfig(deps.visitorId);
      p.currentYaml = yaml;
      deps.onEvent({
        type: "pipeline_draft",
        draft: {
          yaml,
          valid,
          ...(error ? { error } : {}),
          model: cfg?.modelId ?? "unknown",
          ...(notes ? { notes } : {}),
          trace: [...p.trace],
        },
      });

      return asToolResult({
        ok: valid,
        valid,
        ...(error ? { error } : {}),
        message: valid
          ? "草稿已接受。请调用 install_pipeline 执行安装（可再传同一份 yaml）。" +
            (notes ? "备注：" + notes : "")
          : "草稿已提交但校验未通过：" + (error ?? "unknown"),
      });
    },
  };
}

export function installPipelineTool(deps: ToolDeps): AgentTool {
  return {
    name: "install_pipeline",
    label: "安装流水线",
    description:
      "把 pipeline.yaml 写入 tenant 并真正执行安装（download/git_clone/exec/upsert_* → plugins-home）。可先 submit_pipeline 再装，或直接传 yaml。会等待安装结束；成功后可用 list_plugin_home / run_plugin_cli / query_skill 自测。",
    parameters: Type.Object({
      yaml: Type.Optional(
        Type.String({
          description: "完整 YAML；省略则用最近一次 submit / 当前草稿",
        }),
      ),
      notes: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      const p = requirePipeline(deps);
      const raw = params as { yaml?: string; notes?: string };
      const source =
        (typeof raw.yaml === "string" && raw.yaml.trim()
          ? raw.yaml
          : p.currentYaml) ?? "";
      if (!source.trim()) {
        return asToolResult({
          ok: false,
          error: "需要 yaml：先 submit_pipeline 或在本工具传入 yaml",
        });
      }

      let yaml = normalizeDraftYaml(source, p.currentYaml);
      let pipeline;
      try {
        pipeline = parsePipelineYaml(yaml);
      } catch (err) {
        return asToolResult({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      // 自定义安装一律落 tenant（系统母版启用时也复制为可改副本语义：用 yaml 内 id）
      const scope = "tenant" as const;
      try {
        writePipelineYaml(scope, pipeline.id, yaml, deps.visitorId);
      } catch (err) {
        return asToolResult({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      p.currentYaml = yaml;
      const cfg = getVisitorAgentConfig(deps.visitorId);
      const notes =
        typeof raw.notes === "string" && raw.notes.trim()
          ? raw.notes.trim()
          : undefined;
      deps.onEvent({
        type: "pipeline_draft",
        draft: {
          yaml,
          valid: true,
          model: cfg?.modelId ?? "unknown",
          ...(notes ? { notes } : {}),
          trace: [...p.trace],
        },
      });

      const started = startPipelineJob({
        pipeline,
        scope,
        action: "install",
        visitorId: deps.visitorId,
      });
      deps.onEvent({
        type: "pipeline_job",
        scope,
        id: pipeline.id,
        yaml,
        job: jobPublic(started),
      });

      try {
        const finished = await waitForPipelineJob({
          visitorId: deps.visitorId,
          pipelineId: pipeline.id,
          action: "install",
          timeoutMs: 300_000,
          signal: deps.signal,
        });
        deps.onEvent({
          type: "pipeline_job",
          scope,
          id: pipeline.id,
          yaml,
          job: jobPublic(finished),
        });
        const ok = finished.status === "done";
        return asToolResult({
          ok,
          status: finished.status,
          pipelineId: pipeline.id,
          scope,
          error: finished.error,
          logs: finished.logs.slice(-40).map((l) => l.line),
          message: ok
            ? `安装成功：${pipeline.id}。可用 list_plugin_home / run_plugin_cli / query_skill 自测。`
            : `安装失败：${finished.error ?? "unknown"}`,
        });
      } catch (err) {
        return asToolResult({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          pipelineId: pipeline.id,
        });
      }
    },
  };
}

export function pipelineTools(deps: ToolDeps): AgentTool[] {
  return [
    ...pipelineProbeTools(deps),
    submitPipelineTool(deps),
    installPipelineTool(deps),
  ];
}

/** 从当前 YAML 解析 expected id/kind */
export function parsePipelineExpected(currentYaml?: string | null): {
  expectedId?: string;
  expectedKind?: string;
} {
  if (!currentYaml?.trim()) return {};
  try {
    const parsed = parseYaml(currentYaml) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const doc = parsed as Record<string, unknown>;
    const expectedId =
      typeof doc.id === "string" && doc.id.trim() ? doc.id.trim() : undefined;
    const expectedKind =
      typeof doc.kind === "string" && doc.kind.trim() ? doc.kind.trim() : undefined;
    return {
      ...(expectedId ? { expectedId } : {}),
      ...(expectedKind ? { expectedKind } : {}),
    };
  } catch {
    return {};
  }
}
