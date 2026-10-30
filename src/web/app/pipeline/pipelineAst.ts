/**
 * pipeline.yaml ↔ 可编辑 AST（可视化与 YAML 源码共用）。
 */
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type PipelineAst = {
  id: string;
  name: string;
  kind: string;
  runtime?: string;
  data_key?: string;
  version?: string;
  description?: string;
  install_mode?: string;
  outputs: string[];
  probe: Record<string, unknown>[];
  steps: Record<string, unknown>[];
  uninstall: Record<string, unknown>[];
  /** 其它顶层键原样保留，避免丢字段 */
  extras: Record<string, unknown>;
};

const KNOWN = new Set([
  "id",
  "name",
  "kind",
  "runtime",
  "data_key",
  "version",
  "description",
  "install_mode",
  "outputs",
  "probe",
  "steps",
  "uninstall",
  "hooks",
]);

export function parsePipelineAst(source: string): PipelineAst {
  const doc = parseYaml(source) as unknown;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("流水线必须是 YAML 对象");
  }
  const r = doc as Record<string, unknown>;
  const id = String(r.id ?? "").trim();
  if (!id) throw new Error("缺少 id");
  const name = String(r.name ?? "").trim() || id;
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (!KNOWN.has(k)) extras[k] = v;
  }
  const outputs = Array.isArray(r.outputs)
    ? r.outputs.map((o) => String(o))
    : [];
  return {
    id,
    name,
    kind: String(r.kind ?? "tenant"),
    ...(typeof r.runtime === "string" ? { runtime: r.runtime } : {}),
    ...(typeof r.data_key === "string" ? { data_key: r.data_key } : {}),
    ...(typeof r.version === "string" ? { version: r.version } : {}),
    ...(typeof r.description === "string" ? { description: r.description } : {}),
    ...(typeof r.install_mode === "string" ? { install_mode: r.install_mode } : {}),
    outputs,
    probe: Array.isArray(r.probe)
      ? (r.probe as Record<string, unknown>[])
      : [],
    steps: Array.isArray(r.steps)
      ? (r.steps as Record<string, unknown>[])
      : [],
    uninstall: Array.isArray(r.uninstall)
      ? (r.uninstall as Record<string, unknown>[])
      : [],
    extras,
  };
}

export function stringifyPipelineAst(ast: PipelineAst): string {
  const doc: Record<string, unknown> = {
    id: ast.id,
    name: ast.name,
    kind: ast.kind,
  };
  if (ast.runtime) doc.runtime = ast.runtime;
  if (ast.data_key) doc.data_key = ast.data_key;
  if (ast.version) doc.version = ast.version;
  if (ast.description) doc.description = ast.description;
  if (ast.install_mode) doc.install_mode = ast.install_mode;
  doc.outputs = ast.outputs.length ? ast.outputs : ["mcp"];
  if (ast.probe.length) doc.probe = ast.probe;
  doc.steps = ast.steps;
  if (ast.uninstall.length) doc.uninstall = ast.uninstall;
  for (const [k, v] of Object.entries(ast.extras)) {
    if (!(k in doc)) doc[k] = v;
  }
  return stringifyYaml(doc, { lineWidth: 100 });
}

export function stepTypeOf(step: Record<string, unknown>): string {
  return String(step.type ?? "").trim();
}

export function defaultStep(type: string): Record<string, unknown> {
  if (type === "extract") return { type, dest: "bin" };
  if (type === "copy_file") return { type, from: "", to: "" };
  if (type === "upsert_mcp") {
    return {
      type,
      name: "MCP",
      enabled: true,
      transport: "stdio",
      command: "",
      args: [],
    };
  }
  if (type === "upsert_skill") {
    return { type, name: "my_skill", description: "", body: "" };
  }
  if (type === "write_soul_sidecar") {
    return { type, scope: "global", file: "plugin.md", content: "" };
  }
  if (type === "delete_soul_sidecar") {
    return { type, scope: "global", file: "plugin.md" };
  }
  if (type === "remove_mcp") {
    return { type };
  }
  if (type === "remove_skill") {
    return { type, name: "" };
  }
  if (type === "download") {
    return { type, url: "" };
  }
  if (type === "exec") {
    return { type, command: "", args: [], timeout_seconds: 300 };
  }
  return { type };
}
