import { parse as parseYaml } from "yaml";
import {
  PIPELINE_INSTALL_MODES,
  type PipelineInstallMode,
  type PipelineProbe,
  type PipelineStep,
  type PluginPipeline,
} from "./types.js";

const STEP_TYPES = new Set([
  "download",
  "extract",
  "copy_file",
  "git_clone",
  "exec",
  "upsert_mcp",
  "upsert_skill",
  "write_soul_sidecar",
  "delete_soul_sidecar",
  "remove_mcp",
  "remove_skill",
]);

const STEP_CONDITIONS = new Set([
  "always",
  "first_install",
  "probe_passed",
  "probe_failed",
]);

const PROBE_TYPES = new Set(["file_exists", "http_health", "npm_global"]);

function asSteps(raw: unknown, label: string): PipelineStep[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new Error(`${label} must be an array`);
  const out: PipelineStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${label} entries must be objects`);
    }
    const step = item as Record<string, unknown>;
    const type = String(step.type ?? "");
    if (!STEP_TYPES.has(type)) {
      throw new Error(`unknown step type: ${type || "(empty)"}`);
    }
    if (step.when != null) {
      const when = String(step.when);
      if (!STEP_CONDITIONS.has(when)) {
        throw new Error(`invalid when on ${type}: ${when}`);
      }
    }
    if (step.disabled != null && typeof step.disabled !== "boolean") {
      throw new Error(`disabled must be a boolean on ${type}`);
    }
    if (step.skip_on_probe != null && typeof step.skip_on_probe !== "boolean") {
      throw new Error(`skip_on_probe must be a boolean on ${type}`);
    }
    if (type === "copy_file") {
      if (!String(step.from ?? "").trim() || !String(step.to ?? "").trim()) {
        throw new Error("copy_file requires from/to");
      }
    }
    if (type === "exec" && !String(step.command ?? "").trim()) {
      throw new Error("exec.command is required");
    }
    if (type === "git_clone" && !String(step.url ?? "").trim()) {
      throw new Error("git_clone.url is required");
    }
    if (type === "upsert_mcp") {
      const transport = String(step.transport ?? "");
      if (transport !== "stdio" && transport !== "http") {
        throw new Error("upsert_mcp.transport must be stdio or http");
      }
    }
    if (type === "upsert_skill" && !String(step.name ?? "").trim()) {
      throw new Error("upsert_skill.name is required");
    }
    if (type === "remove_skill" && !String(step.name ?? "").trim()) {
      throw new Error("remove_skill.name is required");
    }
    out.push(step as PipelineStep);
  }
  return out;
}

function asProbes(raw: unknown): PipelineProbe[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new Error("probe must be an array");
  return raw.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`probe[${i}] must be an object`);
    }
    const probe = item as Record<string, unknown>;
    const type = String(probe.type ?? "");
    if (!PROBE_TYPES.has(type)) {
      throw new Error(`unknown probe type: ${type || "(empty)"}`);
    }
    return probe as PipelineProbe;
  });
}

/** 解析并做最低限度校验；非法抛 Error。 */
export function parsePipelineYaml(source: string): PluginPipeline {
  const doc = parseYaml(source) as unknown;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("pipeline must be a mapping");
  }
  const r = doc as Record<string, unknown>;
  const id = String(r.id ?? "").trim();
  if (!id) throw new Error("pipeline.id is required");
  const name = String(r.name ?? "").trim();
  if (!name) throw new Error("pipeline.name is required");
  const kindRaw = String(r.kind ?? "user").trim();
  if (kindRaw !== "system" && kindRaw !== "user" && kindRaw !== "tenant") {
    throw new Error('pipeline.kind must be "system" | "user" | "tenant"');
  }
  const outputsRaw = r.outputs;
  if (!Array.isArray(outputsRaw) || outputsRaw.length === 0) {
    throw new Error("pipeline.outputs must be a non-empty array");
  }
  const outputs = outputsRaw.map((o) => String(o));
  for (const o of outputs) {
    if (o !== "mcp" && o !== "skill") {
      throw new Error(`invalid output: ${o}`);
    }
  }
  const steps = asSteps(r.steps, "steps");
  if (steps.length === 0) throw new Error("pipeline.steps must be non-empty");

  let installMode: PipelineInstallMode | undefined;
  if (r.install_mode != null) {
    const raw = String(r.install_mode).trim();
    if (!(PIPELINE_INSTALL_MODES as string[]).includes(raw)) {
      throw new Error(`invalid install_mode: ${raw}`);
    }
    installMode = raw as PipelineInstallMode;
  }

  return {
    id,
    name,
    kind: kindRaw,
    ...(typeof r.runtime === "string" && r.runtime.trim()
      ? { runtime: r.runtime.trim() }
      : {}),
    ...(typeof r.data_key === "string" && r.data_key.trim()
      ? { data_key: r.data_key.trim() }
      : {}),
    ...(typeof r.version === "string" ? { version: r.version } : {}),
    ...(typeof r.description === "string" ? { description: r.description } : {}),
    ...(installMode ? { install_mode: installMode } : {}),
    outputs: outputs as PluginPipeline["outputs"],
    ...(r.probe != null ? { probe: asProbes(r.probe) } : {}),
    steps,
    ...(r.uninstall != null
      ? { uninstall: asSteps(r.uninstall, "uninstall") }
      : {}),
  };
}
