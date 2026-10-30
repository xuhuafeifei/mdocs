/**
 * 系统 / 访客自定义流水线 YAML 落盘与读写。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";
import { getConfig } from "../../config/index.js";
import { parsePipelineYaml } from "./parse.js";
import {
  PIPELINE_INSTALL_MODE_DEFINITIONS,
  type PipelineInstallModeDefinition,
} from "./step-definitions.js";
import { SYSTEM_ENGRAM_ID } from "../plugin-paths.js";
import { migrateLegacyEngramInstall } from "../engram-runtime.js";
import type {
  PipelineInstallMode,
  PipelineOutput,
  PluginPipeline,
} from "./types.js";

function bundledEngramYamlPath(): string {
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../bundled/engram.pipeline.yaml",
  );
}

export function systemPipelinesRoot(): string {
  return path.join(getConfig().dataDir, "plugins", "system");
}

export function visitorPipelinesRoot(visitorId: string): string {
  return path.join(
    getConfig().dataDir,
    "tenant",
    visitorId.trim(),
    "plugins",
  );
}

function pipelineDir(root: string, id: string): string {
  return path.join(root, id.trim());
}

function pipelineYamlPath(root: string, id: string): string {
  return path.join(pipelineDir(root, id), "pipeline.yaml");
}

function pipelineDefaultPath(root: string, id: string): string {
  return path.join(pipelineDir(root, id), "pipeline.yaml.default");
}

export function rollPluginId(): string {
  const n = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
  return n.toString();
}

/** 首次启动：把包内 Engram DEMO 种到 dataDir（不覆盖已有用户改稿）。 */
export function ensureSystemPipelinesSeeded(): void {
  const root = systemPipelinesRoot();
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const dir = pipelineDir(root, SYSTEM_ENGRAM_ID);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const defPath = pipelineDefaultPath(root, SYSTEM_ENGRAM_ID);
  const livePath = pipelineYamlPath(root, SYSTEM_ENGRAM_ID);
  let bundled = "";
  try {
    bundled = fs.readFileSync(bundledEngramYamlPath(), "utf8");
  } catch {
    bundled = [
      `id: "${SYSTEM_ENGRAM_ID}"`,
      "name: Engram",
      "kind: system",
      "runtime: engram",
      "data_key: engram",
      "outputs: [mcp]",
      "steps:",
      "  - type: extract",
      "",
    ].join("\n");
  }
  // 出厂 default 始终与包内模板对齐（便于「恢复初始」拿到镜像 URL 等更新）
  fs.writeFileSync(defPath, bundled, "utf8");
  if (!fs.existsSync(livePath)) {
    fs.writeFileSync(livePath, bundled, "utf8");
  }
  migrateLegacyEngramInstall();
}

export type PipelineListItem = {
  id: string;
  name: string;
  kind: "system" | "user" | "tenant";
  runtime?: string;
  version?: string;
  description?: string;
  outputs: string[];
  installMode: PipelineInstallMode;
  stepCount: number;
  uninstallStepCount: number;
  probeCount: number;
  dataKey?: string;
  /** 安装 / 卸载会写入的灵魂旁路文件名 */
  soulFiles: string[];
  /** 系统插件对应旧 catalog 安装 id（如 engram） */
  installCatalogId?: string | null;
};

export function inferInstallMode(p: PluginPipeline): PipelineInstallMode {
  if (p.install_mode) return p.install_mode;
  if (p.outputs.includes("skill") && !p.outputs.includes("mcp")) {
    return "skill_package";
  }
  if (
    p.steps.some(
      (s) => s.type === "upsert_mcp" && s.transport === "http",
    )
  ) {
    return "remote";
  }
  if (
    p.steps.some(
      (s) =>
        s.type === "download" ||
        s.type === "extract" ||
        s.type === "copy_file",
    )
  ) {
    return "local_binary";
  }
  return "command";
}

function toListItem(p: PluginPipeline): PipelineListItem {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    ...(p.runtime ? { runtime: p.runtime } : {}),
    ...(p.version ? { version: p.version } : {}),
    ...(p.description ? { description: p.description.trim() } : {}),
    outputs: [...p.outputs],
    installMode: inferInstallMode(p),
    stepCount: p.steps.length,
    uninstallStepCount: p.uninstall?.length ?? 0,
    probeCount: p.probe?.length ?? 0,
    ...(p.data_key ? { dataKey: p.data_key } : {}),
    soulFiles: [
      ...new Set(
        [...p.steps, ...(p.uninstall ?? [])]
          .filter(
            (s): s is { type: "write_soul_sidecar"; scope: "global" | "tenant"; file: string } =>
              s.type === "write_soul_sidecar",
          )
          .map((s) => s.file),
      ),
    ],
    installCatalogId: p.runtime === "engram" ? "engram" : null,
  };
}

function listFromRoot(root: string): PipelineListItem[] {
  if (!fs.existsSync(root)) return [];
  const out: PipelineListItem[] = [];
  for (const name of fs.readdirSync(root)) {
    const yamlPath = pipelineYamlPath(root, name);
    if (!fs.existsSync(yamlPath)) continue;
    try {
      const p = parsePipelineYaml(fs.readFileSync(yamlPath, "utf8"));
      out.push(toListItem(p));
    } catch {
      out.push({
        id: name,
        name: name,
        kind: "user",
        outputs: [],
        installMode: "command",
        stepCount: 0,
        uninstallStepCount: 0,
        probeCount: 0,
        soulFiles: [],
        description: "（YAML 解析失败，请编辑修复）",
        installCatalogId: null,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function listSystemPipelines(): PipelineListItem[] {
  ensureSystemPipelinesSeeded();
  return listFromRoot(systemPipelinesRoot());
}

export function listVisitorPipelines(visitorId: string): PipelineListItem[] {
  const id = visitorId.trim();
  if (!id) return [];
  return listFromRoot(visitorPipelinesRoot(id));
}

export function readPipelineYaml(
  scope: "system" | "tenant",
  pluginId: string,
  visitorId?: string,
): string {
  ensureSystemPipelinesSeeded();
  const root =
    scope === "system"
      ? systemPipelinesRoot()
      : visitorPipelinesRoot(visitorId ?? "");
  const p = pipelineYamlPath(root, pluginId);
  if (!fs.existsSync(p)) throw new Error("pipeline not found");
  return fs.readFileSync(p, "utf8");
}

export function readSystemPipelineDefaultYaml(pluginId: string): string {
  ensureSystemPipelinesSeeded();
  const p = pipelineDefaultPath(systemPipelinesRoot(), pluginId);
  if (!fs.existsSync(p)) throw new Error("no default pipeline");
  return fs.readFileSync(p, "utf8");
}

/** 读 + 解析（执行器 / 安装入口用）。 */
export function loadPipeline(
  scope: "system" | "tenant",
  pluginId: string,
  visitorId?: string,
): PluginPipeline {
  const yaml = readPipelineYaml(scope, pluginId, visitorId);
  const parsed = parsePipelineYaml(yaml);
  if (parsed.id !== pluginId.trim()) {
    throw new Error("流水线 id 与目录不一致");
  }
  return parsed;
}

export function writePipelineYaml(
  scope: "system" | "tenant",
  pluginId: string,
  yamlText: string,
  visitorId?: string,
): PluginPipeline {
  const parsed = parsePipelineYaml(yamlText);
  if (parsed.id !== pluginId.trim()) {
    throw new Error(`yaml id (${parsed.id}) must match path id (${pluginId})`);
  }
  if (scope === "system" && parsed.kind !== "system") {
    throw new Error('system pipeline kind must be "system"');
  }
  if (scope === "tenant" && parsed.kind === "system") {
    throw new Error("tenant pipeline cannot use kind system");
  }
  const root =
    scope === "system"
      ? systemPipelinesRoot()
      : visitorPipelinesRoot(visitorId ?? "");
  if (scope === "tenant" && !visitorId?.trim()) {
    throw new Error("visitor required");
  }
  fs.mkdirSync(pipelineDir(root, pluginId), { recursive: true, mode: 0o700 });
  fs.writeFileSync(pipelineYamlPath(root, pluginId), yamlText, "utf8");
  return parsed;
}

export function resetSystemPipeline(pluginId: string): string {
  const text = readSystemPipelineDefaultYaml(pluginId);
  fs.writeFileSync(
    pipelineYamlPath(systemPipelinesRoot(), pluginId),
    text,
    "utf8",
  );
  return text;
}

function modeDefinition(
  mode: PipelineInstallMode,
): PipelineInstallModeDefinition {
  return (
    PIPELINE_INSTALL_MODE_DEFINITIONS.find((m) => m.value === mode) ??
    PIPELINE_INSTALL_MODE_DEFINITIONS[0]!
  );
}

export function createVisitorPipeline(
  visitorId: string,
  opts?: {
    name?: string;
    installMode?: PipelineInstallMode;
    outputs?: PipelineOutput[];
  },
): { id: string; yaml: string } {
  const vid = visitorId.trim();
  if (!vid) throw new Error("visitor required");
  const id = rollPluginId();
  const mode =
    opts?.installMode ??
    (opts?.outputs?.includes("skill") && !opts?.outputs?.includes("mcp")
      ? "skill_package"
      : "remote");
  const def = modeDefinition(mode);
  const name = (opts?.name ?? "自定义插件").trim() || "自定义插件";
  const outputs: PipelineOutput[] =
    opts?.outputs?.length ? [...opts.outputs] : [...def.outputs];

  const steps = def.starterSteps.map((step) => {
    const next = { ...step };
    if (next.type === "upsert_mcp" && typeof next.name === "string") {
      next.name = name;
    }
    if (next.type === "upsert_skill") {
      next.name = name.replace(/\s+/g, "_").toLowerCase();
      next.description = `${name}：说明这个 Skill 何时使用。`;
      next.body = `# ${name}\n\n说明这个 Skill 的适用场景、步骤与注意事项。\n`;
    }
    return next;
  });

  const uninstall =
    mode === "skill_package"
      ? [
          {
            type: "remove_skill",
            name: String(steps.find((s) => s.type === "upsert_skill")?.name ?? "my_skill"),
          },
        ]
      : [{ type: "remove_mcp" }];

  const doc: Record<string, unknown> = {
    id,
    name,
    kind: "tenant",
    install_mode: mode,
    description: `${def.label}：${def.description}`,
    outputs,
    steps,
    uninstall,
  };
  const yaml = stringifyYaml(doc, { lineWidth: 100 });
  writePipelineYaml("tenant", id, yaml, vid);
  return { id, yaml };
}

export function deleteVisitorPipeline(visitorId: string, pluginId: string): void {
  const root = visitorPipelinesRoot(visitorId);
  const dir = pipelineDir(root, pluginId);
  if (!fs.existsSync(dir)) throw new Error("pipeline not found");
  fs.rmSync(dir, { recursive: true, force: true });
}

export { SYSTEM_ENGRAM_ID };
