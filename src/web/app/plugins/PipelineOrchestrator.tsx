/**
 * 流水线编排器 v2：有序步骤（拖拽/禁用/复制/条件）+ Schema 表单 + Probe 独立区 + YAML 高级视图。
 */
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import type {
  PipelineInstallModeDefinition,
  PipelineListItem,
  PipelineStepDefinition,
  PipelineStepFieldDef,
} from "../../services/endpoints";
import {
  fetchPipelineYamlApi,
  fetchSystemPipelineDefaultApi,
  resetSystemPipelineApi,
  savePipelineYamlApi,
} from "../../services/endpoints";
import { AiPipelinePanel } from "./AiPipelinePanel";
import {
  defaultStep,
  parsePipelineAst,
  stringifyPipelineAst,
  stepTypeOf,
  type PipelineAst,
} from "../pipeline/pipelineAst";
import {
  probeLabel,
  probeSummary,
  sourceLabel,
  modeLabel,
  stepLabel,
  stepSummary,
  whenLabel,
} from "./pluginMeta";
import "./plugins.css";

export type StepDefsPayload = {
  steps: PipelineStepDefinition[];
  probes: PipelineStepDefinition[];
  installModes: PipelineInstallModeDefinition[];
  whenOptions: Array<{ value: string; label: string }>;
};

type Props = {
  pipe: PipelineListItem;
  defs: StepDefsPayload;
  onClose: () => void;
  onSaved: () => void;
};

type Selection =
  | { kind: "step"; index: number }
  | { kind: "probe"; index: number }
  | null;

function fieldVisible(
  def: PipelineStepFieldDef,
  step: Record<string, unknown>,
): boolean {
  if (!def.visibleWhen) return true;
  return String(step[def.visibleWhen.field] ?? "") === def.visibleWhen.equals;
}

function fieldValue(step: Record<string, unknown>, def: PipelineStepFieldDef): unknown {
  return step[def.name] ?? def.default;
}

function asText(value: unknown): string {
  return value == null ? "" : String(value);
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
  );
}

function FieldControl(props: {
  def: PipelineStepFieldDef;
  step: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const { def, step, onChange } = props;
  const value = fieldValue(step, def);
  if (def.type === "bool") {
    return (
      <label className="pl-check">
        <input
          type="checkbox"
          checked={Boolean(value ?? false)}
          onChange={(e) => onChange({ ...step, [def.name]: e.target.checked })}
        />
        <span>{def.label ?? def.name}</span>
      </label>
    );
  }
  if (def.type === "select") {
    return (
      <div className="pl-field">
        <label>
          {def.label ?? def.name}
          {def.required ? " *" : ""}
        </label>
        <select
          className="pl-select"
          value={asText(value)}
          onChange={(e) => onChange({ ...step, [def.name]: e.target.value })}
        >
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {def.description ? <span className="pl-field-hint">{def.description}</span> : null}
      </div>
    );
  }
  if (def.type === "string_list") {
    return (
      <div className="pl-field">
        <label>
          {def.label ?? def.name}
          {def.required ? " *" : ""}
        </label>
        <textarea
          className="pl-textarea mono"
          value={asList(value).join("\n")}
          onChange={(e) =>
            onChange({
              ...step,
              [def.name]: e.target.value
                .split("\n")
                .map((s) => s.trimEnd())
                .filter((s) => s.length > 0),
            })
          }
          placeholder="每行一个"
        />
        {def.description ? <span className="pl-field-hint">{def.description}</span> : null}
      </div>
    );
  }
  if (def.type === "keyvalue") {
    const text = Object.entries(asMap(value))
      .map(([k, v]) => k + "=" + v)
      .join("\n");
    return (
      <div className="pl-field">
        <label>
          {def.label ?? def.name}
          {def.required ? " *" : ""}
        </label>
        <textarea
          className="pl-textarea mono"
          value={text}
          onChange={(e) => {
            const next: Record<string, string> = {};
            for (const line of e.target.value.split("\n")) {
              const t = line.trim();
              if (!t) continue;
              const i = t.indexOf("=");
              if (i <= 0) continue;
              next[t.slice(0, i).trim()] = t.slice(i + 1);
            }
            onChange({ ...step, [def.name]: next });
          }}
          placeholder={"KEY=value\n每行一对"}
        />
        {def.description ? <span className="pl-field-hint">{def.description}</span> : null}
      </div>
    );
  }
  return (
    <div className="pl-field">
      <label>
        {def.label ?? def.name}
        {def.required ? " *" : ""}
      </label>
      {def.type === "textarea" ? (
        <textarea
          className="pl-textarea"
          value={asText(value)}
          onChange={(e) => onChange({ ...step, [def.name]: e.target.value })}
          style={{ minHeight: 110 }}
        />
      ) : (
        <input
          className="pl-input"
          value={asText(value)}
          onChange={(e) => onChange({ ...step, [def.name]: e.target.value })}
        />
      )}
      {def.description ? <span className="pl-field-hint">{def.description}</span> : null}
    </div>
  );
}

function StepFields(props: {
  def: PipelineStepDefinition | undefined;
  step: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const { def, step, onChange } = props;
  const { t } = useI18n();
  if (!def) {
    return (
      <p className="pl-error">
        {t("plValidateFail")}：unknown step type {stepTypeOf(step)}
      </p>
    );
  }
  const visible = def.fields.filter((f) => fieldVisible(f, step));
  const basic = visible.filter((f) => !f.advanced);
  const advanced = visible.filter((f) => f.advanced);
  return (
    <div className="pl-form">
      {basic.map((f) => (
        <FieldControl key={f.name} def={f} step={step} onChange={onChange} />
      ))}
      {advanced.length > 0 ? (
        <details className="pl-advanced">
          <summary>{t("plStepAdvanced")}</summary>
          <div className="pl-form">
            {advanced.map((f) => (
              <FieldControl key={f.name} def={f} step={step} onChange={onChange} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function makeStep(def: PipelineStepDefinition): Record<string, unknown> {
  const step: Record<string, unknown> = { ...defaultStep(def.type), type: def.type };
  for (const field of def.fields) {
    if (field.default !== undefined && step[field.name] === undefined) {
      step[field.name] = field.default;
    }
  }
  if (def.type === "upsert_mcp") {
    step.name = step.name ?? "MCP";
    step.transport = step.transport ?? "stdio";
    step.args = step.args ?? [];
  }
  if (def.type === "exec") {
    step.command = step.command ?? "";
    step.args = step.args ?? [];
    step.timeout_seconds = step.timeout_seconds ?? 300;
  }
  if (def.type === "download") {
    step.url = step.url ?? "";
  }
  return step;
}

export function PipelineOrchestrator(props: Props) {
  const { t } = useI18n();
  const scope = props.pipe.kind === "system" ? "system" : "tenant";
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ast, setAst] = useState<PipelineAst | null>(null);
  const [yamlText, setYamlText] = useState("");
  const [baseline, setBaseline] = useState("");
  const [astDirty, setAstDirty] = useState(false);
  const [view, setView] = useState<"visual" | "yaml">("visual");
  const [flow, setFlow] = useState<"install" | "uninstall">("install");
  const [selection, setSelection] = useState<Selection>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [defaultYaml, setDefaultYaml] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    void fetchPipelineYamlApi(scope, props.pipe.id)
      .then((res) => {
        if (!alive) return;
        const parsed = parsePipelineAst(res.yaml);
        setAst(parsed);
        setYamlText(res.yaml);
        setBaseline(res.yaml);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [scope, props.pipe.id]);

  const defByType = useMemo(() => {
    const map = new Map<string, PipelineStepDefinition>();
    for (const def of props.defs.steps) map.set(def.type, def);
    return map;
  }, [props.defs.steps]);

  const probeDefByType = useMemo(() => {
    const map = new Map<string, PipelineStepDefinition>();
    for (const def of props.defs.probes) map.set(def.type, def);
    return map;
  }, [props.defs.probes]);

  const validation = useMemo(() => {
    if (!yamlText.trim()) return { ok: false, error: "empty" };
    try {
      const parsed = parsePipelineAst(yamlText);
      if (ast && parsed.id !== ast.id) {
        return { ok: false, error: "id must stay " + ast.id };
      }
      if (parsed.steps.length === 0) {
        return { ok: false, error: "steps must be non-empty" };
      }
      if (parsed.outputs.length === 0) {
        return { ok: false, error: "outputs must be non-empty" };
      }
      return { ok: true, error: null as string | null };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [yamlText, ast]);

  const dirty = Boolean(ast) && yamlText !== baseline;

  const steps = ast ? (flow === "install" ? ast.steps : ast.uninstall) : [];
  const riskSteps = ast
    ? ast.steps.filter((s) => ["download", "exec", "copy_file"].includes(stepTypeOf(s)))
    : [];

  function commit(next: PipelineAst) {
    setAst(next);
    setYamlText(stringifyPipelineAst(next));
    setAstDirty(true);
    setError(null);
  }

  function setList(next: Record<string, unknown>[]) {
    if (!ast) return;
    commit(flow === "install" ? { ...ast, steps: next } : { ...ast, uninstall: next });
  }

  function updateStep(index: number, step: Record<string, unknown>) {
    const next = steps.slice();
    next[index] = step;
    setList(next);
  }

  function addStep(type: string) {
    const def = defByType.get(type);
    if (!def) return;
    const next = [...steps, makeStep(def)];
    setList(next);
    setSelection({ kind: "step", index: next.length - 1 });
    setAddOpen(false);
  }

  function duplicateStep(index: number) {
    const clone = JSON.parse(JSON.stringify(steps[index])) as Record<string, unknown>;
    const next = [...steps.slice(0, index + 1), clone, ...steps.slice(index + 1)];
    setList(next);
    setSelection({ kind: "step", index: index + 1 });
  }

  function removeStep(index: number) {
    const next = steps.filter((_, i) => i !== index);
    setList(next);
    setSelection(null);
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = steps.slice();
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setList(next);
    setSelection({ kind: "step", index: to });
  }

  function addProbe(type: string) {
    if (!ast) return;
    const def = probeDefByType.get(type);
    if (!def) return;
    const probe: Record<string, unknown> = { type };
    for (const field of def.fields) {
      if (field.default !== undefined) probe[field.name] = field.default;
    }
    const next = [...ast.probe, probe];
    commit({ ...ast, probe: next });
    setSelection({ kind: "probe", index: next.length - 1 });
  }

  function updateProbe(index: number, probe: Record<string, unknown>) {
    if (!ast) return;
    const next = ast.probe.slice();
    next[index] = probe;
    commit({ ...ast, probe: next });
  }

  function removeProbe(index: number) {
    if (!ast) return;
    commit({ ...ast, probe: ast.probe.filter((_, i) => i !== index) });
    setSelection(null);
  }

  function switchView(next: "visual" | "yaml") {
    if (next === "visual") {
      try {
        const parsed = parsePipelineAst(yamlText);
        if (ast && parsed.id !== ast.id) {
          setError(t("plValidateFail") + "：id must stay " + ast.id);
          return;
        }
        setAst(parsed);
        setAstDirty(false);
        setError(null);
        setView("visual");
      } catch (err) {
        setError(
          t("plValidateFail") + "：" + (err instanceof Error ? err.message : String(err)),
        );
      }
      return;
    }
    if (ast && astDirty) setYamlText(stringifyPipelineAst(ast));
    setError(null);
    setView("yaml");
  }

  async function save() {
    if (!ast) return;
    let yaml = yamlText;
    try {
      const parsed = parsePipelineAst(yamlText);
      if (parsed.id !== ast.id) throw new Error("id must stay " + ast.id);
      if (view === "visual") {
        yaml = stringifyPipelineAst(ast);
      }
      setSaving(true);
      setError(null);
      await savePipelineYamlApi(scope, ast.id, yaml);
      setBaseline(yaml);
      setYamlText(yaml);
      setAstDirty(false);
      props.onSaved();
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!ast) return;
    if (!window.confirm(t("pluginPipelineResetConfirm"))) return;
    setSaving(true);
    setError(null);
    try {
      const res = await resetSystemPipelineApi(ast.id);
      const parsed = parsePipelineAst(res.yaml);
      setAst(parsed);
      setYamlText(res.yaml);
      setBaseline(res.yaml);
      setAstDirty(false);
      setSelection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function viewDefault() {
    try {
      const res = await fetchSystemPipelineDefaultApi(props.pipe.id);
      setDefaultYaml(res.yaml);
      setDefaultOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function applyAiYaml(yaml: string) {
    try {
      const parsed = parsePipelineAst(yaml);
      if (ast && parsed.id !== ast.id) {
        throw new Error("id must stay " + ast.id);
      }
      setAst(parsed);
      setYamlText(stringifyPipelineAst(parsed));
      setAstDirty(false);
      setFlow("install");
      setSelection(null);
      setError(null);
    } catch (err) {
      setYamlText(yaml);
      setView("yaml");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function close() {
    if (dirty && !window.confirm(t("plUnsavedConfirm"))) return;
    props.onClose();
  }

  if (loading) {
    return (
      <div className="pl-overlay">
        <div className="pl-modal">
          <div className="pl-modal-body">
            <p className="pl-section-hint">{t("loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !ast) {
    return (
      <div className="pl-overlay">
        <div className="pl-modal">
          <div className="pl-modal-head">
            <h3>{props.pipe.name}</h3>
            <button type="button" className="pl-x" onClick={props.onClose}>
              ×
            </button>
          </div>
          <div className="pl-modal-body">
            <p className="pl-error">{loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  const current = selection?.kind === "step" ? steps[selection.index] : undefined;
  const currentDef = current ? defByType.get(stepTypeOf(current)) : undefined;
  const currentProbe =
    selection?.kind === "probe" ? ast.probe[selection.index] : undefined;
  const currentProbeDef = currentProbe
    ? probeDefByType.get(String(currentProbe.type ?? ""))
    : undefined;
  const addableDefs = props.defs.steps.filter((d) =>
    flow === "install"
      ? d.category === "install" || d.category === "configure"
      : d.category === "uninstall",
  );
  const addGroups = [...new Set(addableDefs.map((d) => d.group))];

  const configStep = current;
  const configStepIndex = selection?.kind === "step" ? selection.index : -1;

  return (
    <div className="pl-overlay" role="dialog" aria-modal="true">
      <div className="pl-orch">
        <div className="pl-orch-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="pl-orch-title">{props.pipe.name}</h2>
            <div className="pl-orch-meta">
              <span className="pl-badge outline">
                {props.pipe.outputs.includes("skill") ? "Skill" : "MCP"}
              </span>
              <span className="pl-badge outline">{modeLabel(props.pipe.installMode, t)}</span>
              <span className={props.pipe.kind === "system" ? "pl-badge system" : "pl-badge tenant"}>
                {sourceLabel(props.pipe.kind, t)}
              </span>
              <span className="pl-mini-hint">
                id {ast.id}
                {ast.runtime ? " · runtime " + ast.runtime : ""}
              </span>
              {dirty ? (
                <span className="pl-dirty">
                  <span className="dot" />
                  {t("plOrchUnsaved")}
                </span>
              ) : null}
            </div>
          </div>
          <div className="pl-orch-actions">
            <div className="pl-seg">
              <button
                type="button"
                className={view === "visual" ? "active" : ""}
                onClick={() => switchView("visual")}
              >
                {t("pluginOrchVisual")}
              </button>
              <button
                type="button"
                className={view === "yaml" ? "active" : ""}
                onClick={() => switchView("yaml")}
              >
                {t("pluginOrchYaml")}
              </button>
            </div>
            <button type="button" className="pl-btn" onClick={() => setAiOpen(true)}>
              ✨ {t("plAiTitle")}
            </button>
            <button type="button" className="pl-x" onClick={close} aria-label={t("close")}>
              ×
            </button>
          </div>
        </div>

        {view === "yaml" ? (
          <div style={{ flex: 1, minHeight: 0, padding: "16px 20px", overflow: "auto" }}>
            <div className="pl-yaml-wrap">
              <div className="pl-yaml-bar">
                <span>pipeline.yaml</span>
                {validation.ok ? (
                  <span className="pl-valid-ok">{t("plValidateOk")}</span>
                ) : (
                  <span className="pl-valid-bad">
                    {t("plValidateFail")}：{validation.error}
                  </span>
                )}
                <span style={{ flex: 1 }} />
                {props.pipe.kind === "system" ? (
                  <button type="button" className="pl-btn sm ghost" onClick={() => void viewDefault()}>
                    {t("plViewDefault")}
                  </button>
                ) : null}
              </div>
              <textarea
                className="pl-yaml-editor"
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        ) : (
          <div className="pl-orch-body">
            <div className="pl-orch-left">
              <div className="pl-flowbar">
                <button
                  type="button"
                  className={flow === "install" ? "active" : ""}
                  onClick={() => {
                    setFlow("install");
                    setSelection(null);
                  }}
                >
                  {t("pluginOrchInstallFlow")} · {ast.steps.length}
                </button>
                <button
                  type="button"
                  className={flow === "uninstall" ? "active" : ""}
                  onClick={() => {
                    setFlow("uninstall");
                    setSelection(null);
                  }}
                >
                  {t("pluginOrchUninstallFlow")} · {ast.uninstall.length}
                </button>
              </div>

              {riskSteps.length > 0 ? (
                <div className="pl-risk">
                  <span>⚠</span>
                  <span>{t("plRiskNote")}</span>
                </div>
              ) : null}

              {flow === "install" ? (
                <div className="pl-probe-card">
                  <div className="pl-subhead">
                    <h4>{t("plProbeTitle")}</h4>
                    <select
                      className="pl-select"
                      style={{ width: "auto", padding: "3px 8px", fontSize: 11 }}
                      defaultValue=""
                      onChange={(e) => {
                        const type = e.target.value;
                        e.target.value = "";
                        if (type) addProbe(type);
                      }}
                    >
                      <option value="">{t("plProbeAdd")}</option>
                      {props.defs.probes.map((p) => (
                        <option key={p.type} value={p.type}>
                          {probeLabel(p.type, p.label, t)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pl-probe-hint">{t("plProbeDesc")}</div>
                  {ast.probe.length === 0 ? (
                    <div className="pl-probe-hint">{t("plProbeEmpty")}</div>
                  ) : (
                    ast.probe.map((probe, i) => {
                      const active = selection?.kind === "probe" && selection.index === i;
                      return (
                        <div
                          key={i}
                          className={active ? "pl-probe-item active" : "pl-probe-item"}
                          onClick={() => setSelection({ kind: "probe", index: i })}
                        >
                          <span>◇</span>
                          <span className="grow">
                            {probeLabel(String(probe.type ?? ""), undefined, t)}
                            {probeSummary(probe) ? " · " + probeSummary(probe) : ""}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}

              <div className="pl-subhead">
                <h4>
                  {flow === "install"
                    ? t("pluginOrchInstallFlow")
                    : t("pluginOrchUninstallFlow")}
                </h4>
                <span className="pl-mini-hint">{steps.length}</span>
              </div>

              <div>
                {steps.length === 0 ? (
                  <div className="pl-empty-steps">{t("plOrchEmptySteps")}</div>
                ) : (
                  steps.map((step, index) => {
                    const type = stepTypeOf(step);
                    const def = defByType.get(type);
                    const active = selection?.kind === "step" && selection.index === index;
                    const when = whenLabel(String(step.when ?? ""), t);
                    const cls = [
                      "pl-step",
                      active ? "active" : "",
                      step.disabled === true ? "disabled" : "",
                      dragIndex === index ? "dragging" : "",
                      overIndex === index && dragIndex !== index ? "dragover" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <div
                        key={type + "-" + index}
                        className={cls}
                        draggable
                        onDragStart={(e) => {
                          setDragIndex(index);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOverIndex(index);
                        }}
                        onDragLeave={() => setOverIndex(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex != null) reorder(dragIndex, index);
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        onClick={() => setSelection({ kind: "step", index })}
                      >
                        <div className="pl-step-num" title="drag">
                          <span className="n">{String(index + 1).padStart(2, "0")}</span>
                          <span>⋮⋮</span>
                        </div>
                        <div className="pl-step-main">
                          <div className="pl-step-title">
                            {stepLabel(type, def?.label, t)}
                            {step.disabled === true ? (
                              <span className="pl-tag warn">{t("plStepDisabled")}</span>
                            ) : null}
                          </div>
                          <div className="pl-step-sub">{stepSummary(step, t) || type}</div>
                          <div className="pl-step-tags">
                            <span className="pl-tag">{type}</span>
                            {when ? <span className="pl-tag warn">{when}</span> : null}
                          </div>
                        </div>
                        <div className="pl-step-actions">
                          <button
                            type="button"
                            className="pl-icon-btn"
                            title={t("plStepDuplicate")}
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateStep(index);
                            }}
                          >
                            ⧉
                          </button>
                          <button
                            type="button"
                            className="pl-icon-btn"
                            title={
                              step.disabled === true ? t("plStepEnable") : t("plStepDisable")
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStep(index, { ...step, disabled: step.disabled !== true });
                            }}
                          >
                            {step.disabled === true ? "◉" : "◌"}
                          </button>
                          <button
                            type="button"
                            className="pl-icon-btn danger"
                            title={t("delete")}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeStep(index);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                <button type="button" className="pl-add-step" onClick={() => setAddOpen(true)}>
                  ＋ {t("pluginOrchAddStep")}
                </button>
              </div>
            </div>

            <div className="pl-orch-right">
              {configStep && configStepIndex >= 0 ? (
                <>
                  <div className="pl-config-head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3>
                        {stepLabel(stepTypeOf(configStep), currentDef?.label, t)}
                        <span className="pl-tag" style={{ marginLeft: 8 }}>
                          {stepTypeOf(configStep)}
                        </span>
                      </h3>
                      <p>{currentDef?.description}</p>
                    </div>
                  </div>
                  <StepFields
                    def={currentDef}
                    step={configStep}
                    onChange={(next) => updateStep(configStepIndex, next)}
                  />
                  <div className="pl-config-section">{t("plStepBehavior")}</div>
                  <div className="pl-form">
                    <div className="pl-form-grid">
                      <div className="pl-field">
                        <label>{t("plStepWhen")}</label>
                        <select
                          className="pl-select"
                          value={String(configStep.when ?? "always")}
                          onChange={(e) =>
                            updateStep(configStepIndex, {
                              ...configStep,
                              when: e.target.value,
                            })
                          }
                        >
                          <option value="always">{t("plStepConditionAlways")}</option>
                          <option value="first_install">{t("plStepConditionFirst")}</option>
                          <option value="probe_passed">{t("plStepConditionProbePassed")}</option>
                          <option value="probe_failed">{t("plStepConditionProbeFailed")}</option>
                        </select>
                      </div>
                      <div className="pl-field">
                        <label>{t("plStepSkipOnProbe")}</label>
                        <label className="pl-check">
                          <input
                            type="checkbox"
                            checked={
                              configStep.skip_on_probe === true ||
                              (configStep.skip_on_probe === undefined &&
                                ["download", "extract", "copy_file"].includes(
                                  stepTypeOf(configStep),
                                ))
                            }
                            onChange={(e) =>
                              updateStep(configStepIndex, {
                                ...configStep,
                                skip_on_probe: e.target.checked,
                              })
                            }
                          />
                          <span>{t("plEnable")}</span>
                        </label>
                      </div>
                    </div>
                    <label className="pl-check">
                      <input
                        type="checkbox"
                        checked={configStep.disabled === true}
                        onChange={(e) =>
                          updateStep(configStepIndex, {
                            ...configStep,
                            disabled: e.target.checked,
                          })
                        }
                      />
                      <span>{t("plStepDisable")}</span>
                    </label>
                  </div>
                </>
              ) : currentProbe ? (
                <>
                  <div className="pl-config-head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3>
                        {probeLabel(
                          String(currentProbe.type ?? ""),
                          currentProbeDef?.label,
                          t,
                        )}
                      </h3>
                      <p>{currentProbeDef?.description}</p>
                    </div>
                    <button
                      type="button"
                      className="pl-btn sm danger"
                      onClick={() => {
                        if (selection?.kind === "probe") removeProbe(selection.index);
                      }}
                    >
                      {t("delete")}
                    </button>
                  </div>
                  <StepFields
                    def={currentProbeDef}
                    step={currentProbe}
                    onChange={(next) => {
                      if (selection?.kind === "probe") updateProbe(selection.index, next);
                    }}
                  />
                </>
              ) : (
                <>
                  <div className="pl-config-head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3>{t("plMeta")}</h3>
                      <p>{t("plMetaHint")}</p>
                    </div>
                  </div>
                  <div className="pl-form">
                    <div className="pl-field">
                      <label>{t("plMetaName")}</label>
                      <input
                        className="pl-input"
                        value={ast.name}
                        onChange={(e) => commit({ ...ast, name: e.target.value })}
                      />
                    </div>
                    <div className="pl-field">
                      <label>{t("plMetaDesc")}</label>
                      <textarea
                        className="pl-textarea"
                        value={ast.description ?? ""}
                        onChange={(e) => commit({ ...ast, description: e.target.value })}
                        style={{ minHeight: 76 }}
                      />
                    </div>
                    <div className="pl-form-grid">
                      <div className="pl-field">
                        <label>{t("plMetaMode")}</label>
                        <select
                          className="pl-select"
                          value={ast.install_mode ?? props.pipe.installMode}
                          onChange={(e) => commit({ ...ast, install_mode: e.target.value })}
                        >
                          {props.defs.installModes.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="pl-field">
                        <label>{t("plMetaOutputs")}</label>
                        <div style={{ display: "flex", gap: 14, paddingTop: 4 }}>
                          {(["mcp", "skill"] as const).map((o) => (
                            <label key={o} className="pl-check">
                              <input
                                type="checkbox"
                                checked={ast.outputs.includes(o)}
                                onChange={(e) => {
                                  const set = new Set(ast.outputs);
                                  if (e.target.checked) set.add(o);
                                  else set.delete(o);
                                  if (set.size === 0) return;
                                  commit({ ...ast, outputs: [...set] });
                                }}
                              />
                              <span>{o.toUpperCase()}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="pl-field">
                      <label>{t("plVersion")}</label>
                      <input
                        className="pl-input"
                        value={ast.version ?? ""}
                        onChange={(e) => commit({ ...ast, version: e.target.value })}
                        placeholder="3.6.0"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="pl-orch-foot">
          {error ? <span className="pl-error">{error}</span> : null}
          {!error ? (
            <span className={validation.ok ? "pl-valid-ok" : "pl-valid-bad"}>
              {validation.ok
                ? t("plValidateOk")
                : t("plValidateFail") + "：" + validation.error}
            </span>
          ) : null}
          <span style={{ flex: 1 }} />
          {props.pipe.kind === "system" ? (
            <button
              type="button"
              className="pl-btn ghost"
              disabled={saving}
              onClick={() => void reset()}
            >
              {t("pluginPipelineReset")}
            </button>
          ) : null}
          <button type="button" className="pl-btn ghost" disabled={saving} onClick={close}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="pl-btn primary"
            disabled={saving || !validation.ok}
            onClick={() => void save()}
          >
            {saving ? t("pluginBusy") : t("pluginPipelineSave")}
          </button>
        </div>
      </div>

      {addOpen ? (
        <div className="pl-overlay" style={{ zIndex: 250 }}>
          <div className="pl-modal">
            <div className="pl-modal-head">
              <div style={{ flex: 1 }}>
                <h3>{t("plOrchAddStepTitle")}</h3>
                <p className="pl-modal-sub">{t("plOrchAddStepHint")}</p>
              </div>
              <button type="button" className="pl-x" onClick={() => setAddOpen(false)}>
                ×
              </button>
            </div>
            <div className="pl-modal-body">
              {addGroups.map((group) => (
                <div key={group} className="pl-block">
                  <div className="pl-block-title">{group}</div>
                  <div className="pl-choice-grid">
                    {addableDefs
                      .filter((d) => d.group === group)
                      .map((d) => (
                        <button
                          key={d.type}
                          type="button"
                          className="pl-choice"
                          onClick={() => addStep(d.type)}
                        >
                          <div className="pl-choice-title">
                            {stepLabel(d.type, d.label, t)}
                          </div>
                          <p className="pl-choice-desc">{d.description}</p>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {defaultOpen && defaultYaml ? (
        <div className="pl-overlay" style={{ zIndex: 250 }}>
          <div className="pl-modal">
            <div className="pl-modal-head">
              <div style={{ flex: 1 }}>
                <h3>{t("plViewDefault")}</h3>
                <p className="pl-modal-sub">pipeline.yaml.default</p>
              </div>
              <button type="button" className="pl-x" onClick={() => setDefaultOpen(false)}>
                ×
              </button>
            </div>
            <div className="pl-modal-body">
              <pre className="pl-default-pane">{defaultYaml}</pre>
            </div>
          </div>
        </div>
      ) : null}

      {aiOpen ? (
        <AiPipelinePanel
          initialKind={props.pipe.outputs.includes("skill") ? "skill" : "mcp"}
          initialMode={props.pipe.installMode}
          modes={props.defs.installModes}
          currentYaml={yamlText}
          onClose={() => setAiOpen(false)}
          onApply={applyAiYaml}
        />
      ) : null}
    </div>
  );
}
