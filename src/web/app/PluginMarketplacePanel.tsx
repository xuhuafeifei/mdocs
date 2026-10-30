/**
 * 插件市场 v2：已安装 / 可安装 / 新建；卡片打开详情或流水线编排器。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import {
  createCustomPipelineApi,
  deleteCustomPipelineApi,
  fetchPipelineYamlApi,
  fetchPipelinesApi,
  fetchStepDefinitionsApi,
  generatePipelineDraftApi,
  savePipelineYamlApi,
  type PipelineInstallHistoryEntry,
  type PipelineInstallMode,
  type PipelineListItem,
} from "../services/endpoints";
import { parsePipelineAst } from "./pipeline/pipelineAst";
import { PipelineOrchestrator, type StepDefsPayload } from "./plugins/PipelineOrchestrator";
import { PipelineInstallRunner } from "./plugins/PipelineInstallRunner";
import {
  formatDateTime,
  historyFor,
  modeLabel,
  outputsLabel,
  sourceClass,
  sourceLabel,
  statusOf,
  stepLabel,
  stepSummary,
} from "./plugins/pluginMeta";
import "./plugins/plugins.css";

type Filter = "all" | "skill" | "mcp";
type RunnerState = { pipe: PipelineListItem; action: "install" | "uninstall" };

function jobProgress(pipe: PipelineListItem): { percent: number; text: string } {
  const steps = pipe.installJob?.steps ?? [];
  if (steps.length === 0) return { percent: 0, text: "" };
  const done = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  return {
    percent: Math.round((done / steps.length) * 100),
    text: done + "/" + steps.length,
  };
}

function PluginCard(props: {
  pipe: PipelineListItem;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onEdit: () => void;
  onDetail: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const { pipe } = props;
  const status = statusOf(pipe, t);
  const running = pipe.installJob?.status === "running";
  const progress = running ? jobProgress(pipe) : null;
  const isSkill = pipe.outputs.includes("skill") && !pipe.outputs.includes("mcp");
  const cls = ["pl-card", running ? "running" : ""].filter(Boolean).join(" ");

  return (
    <article className={cls}>
      <div className="pl-card-top">
        <div className={isSkill ? "pl-icon skill" : "pl-icon"}>{isSkill ? "S" : "M"}</div>
        <div className="pl-card-heading">
          <h3 className="pl-name" title={pipe.name}>
            {pipe.name}
          </h3>
          <div className="pl-badges">
            <span className={isSkill ? "pl-badge skill" : "pl-badge mcp"}>
              {outputsLabel(pipe.outputs)}
            </span>
            <span className="pl-badge outline">{modeLabel(pipe.installMode, t)}</span>
            <span className={"pl-badge " + sourceClass(pipe.kind)}>
              {sourceLabel(pipe.kind, t)}
            </span>
          </div>
        </div>
      </div>

      <p className="pl-desc">{pipe.description || t("plNoDescription")}</p>

      <div className="pl-meta-row">
        <span>{t("plStepsCount", { count: String(pipe.stepCount) })}</span>
        {pipe.probeCount > 0 ? (
          <span>{t("plProbeCount", { count: String(pipe.probeCount) })}</span>
        ) : null}
        <span className={"pl-status " + status.tone}>
          <span className="dot" />
          {status.label}
        </span>
      </div>

      {progress ? (
        <div>
          <div className="pl-progress">
            <span style={{ width: progress.percent + "%" }} />
          </div>
          <div className="pl-mini-hint" style={{ marginTop: 4 }}>
            {progress.text}
          </div>
        </div>
      ) : null}

      <div className="pl-card-actions">
        {pipe.installed ? (
          <>
            <button
              type="button"
              className="pl-btn sm"
              disabled={props.busy || running}
              onClick={props.onUninstall}
            >
              {t("pluginUninstall")}
            </button>
            <button
              type="button"
              className="pl-btn sm ghost"
              disabled={props.busy || running}
              onClick={props.onInstall}
            >
              {t("plReinstall")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="pl-btn sm primary"
            disabled={props.busy || running}
            onClick={props.onInstall}
          >
            {running ? t("pluginInstalling") : t("pluginInstall")}
          </button>
        )}
        <button type="button" className="pl-btn sm ghost" onClick={props.onEdit}>
          {t("pluginPipelineEdit")}
        </button>
        <span className="spacer" />
        <button type="button" className="pl-btn sm ghost" onClick={props.onDetail}>
          {t("plViewDetails")}
        </button>
        {pipe.kind !== "system" ? (
          <button
            type="button"
            className="pl-btn sm ghost danger"
            onClick={props.onDelete}
            disabled={props.busy}
          >
            {t("delete")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PluginDetail(props: {
  pipe: PipelineListItem;
  history: PipelineInstallHistoryEntry[];
  onClose: () => void;
  onEdit: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const { t } = useI18n();
  const { pipe } = props;
  const status = statusOf(pipe, t);
  const history = historyFor(props.history, pipe.id);
  const [steps, setSteps] = useState<Array<Record<string, unknown>> | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchPipelineYamlApi(pipe.kind === "system" ? "system" : "tenant", pipe.id)
      .then((res) => {
        if (!alive) return;
        try {
          setSteps(parsePipelineAst(res.yaml).steps);
        } catch {
          setSteps([]);
        }
      })
      .catch(() => {
        if (alive) setSteps([]);
      });
    return () => {
      alive = false;
    };
  }, [pipe.id, pipe.kind]);

  return (
    <div className="pl-overlay" role="dialog" aria-modal="true">
      <div className="pl-modal wide">
        <div className="pl-modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{pipe.name}</h3>
            <div className="pl-orch-meta">
              <span className={pipe.outputs.includes("skill") ? "pl-badge skill" : "pl-badge mcp"}>
                {outputsLabel(pipe.outputs)}
              </span>
              <span className="pl-badge outline">{modeLabel(pipe.installMode, t)}</span>
              <span className={"pl-badge " + sourceClass(pipe.kind)}>
                {sourceLabel(pipe.kind, t)}
              </span>
              <span className={"pl-status " + status.tone}>
                <span className="dot" />
                {status.label}
              </span>
            </div>
          </div>
          <button type="button" className="pl-x" onClick={props.onClose} aria-label={t("close")}>
            ×
          </button>
        </div>

        <div className="pl-modal-body">
          <p className="pl-desc" style={{ minHeight: 0 }}>
            {pipe.description || t("plNoDescription")}
          </p>

          <div className="pl-detail-grid">
            <div className="pl-kv">
              <span className="pl-kv-label">ID</span>
              <span className="pl-kv-value mono">{pipe.id}</span>
            </div>
            <div className="pl-kv">
              <span className="pl-kv-label">{t("plMetaMode")}</span>
              <span className="pl-kv-value">{modeLabel(pipe.installMode, t)}</span>
            </div>
            <div className="pl-kv">
              <span className="pl-kv-label">{t("plOrigin")}</span>
              <span className="pl-kv-value">{sourceLabel(pipe.kind, t)}</span>
            </div>
            <div className="pl-kv">
              <span className="pl-kv-label">{t("plMetaOutputs")}</span>
              <span className="pl-kv-value">{outputsLabel(pipe.outputs)}</span>
            </div>
            <div className="pl-kv">
              <span className="pl-kv-label">{t("plInstalledAt")}</span>
              <span className="pl-kv-value">
                {pipe.installedAt ? formatDateTime(pipe.installedAt) : "—"}
              </span>
            </div>
            <div className="pl-kv">
              <span className="pl-kv-label">{t("plRuntimeStatus")}</span>
              <span className="pl-kv-value">
                {!pipe.installed
                  ? "—"
                  : pipe.runtime === "engram"
                    ? pipe.runtimeRunning
                      ? t("pluginRuntimeRunning")
                      : t("pluginRuntimeStopped")
                    : "—"}
              </span>
            </div>
          </div>

          <div className="pl-block">
            <div className="pl-block-title">{t("plStorage")}</div>
            <div className="pl-list">
              <div className="pl-list-item">
                <span className="muted">{t("plInstallDir")}</span>
                <span className="grow mono">{pipe.storage.installDir}</span>
              </div>
              {pipe.storage.dataDir ? (
                <div className="pl-list-item">
                  <span className="muted">{t("plDataDir")}</span>
                  <span className="grow mono">{pipe.storage.dataDir}</span>
                </div>
              ) : null}
              {pipe.storage.soulFiles.map((f) => (
                <div className="pl-list-item" key={f}>
                  <span className="muted">{t("plSoulFiles")}</span>
                  <span className="grow mono">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pl-block">
            <div className="pl-block-title">
              {t("pluginOrchSteps")} · {pipe.stepCount}
            </div>
            <div className="pl-list">
              {(steps ?? []).map((s, i) => {
                const type = String(s.type ?? "");
                return (
                  <div className="pl-list-item" key={i}>
                    <span className="muted">{String(i + 1).padStart(2, "0")}</span>
                    <span className="grow">
                      {stepLabel(type, undefined, t)}
                      <span className="muted"> · {stepSummary(s, t)}</span>
                    </span>
                    <span className="pl-tag">{type}</span>
                  </div>
                );
              })}
              {steps && steps.length === 0 ? (
                <span className="pl-mini-hint">{t("plOrchEmptySteps")}</span>
              ) : null}
            </div>
          </div>

          <div className="pl-block">
            <div className="pl-block-title">{t("plInstallHistory")}</div>
            {history.length === 0 ? (
              <span className="pl-mini-hint">{t("plNoHistory")}</span>
            ) : (
              <div className="pl-list">
                {history.map((h, i) => (
                  <div className="pl-list-item" key={i}>
                    <span className="pl-tag">{h.action === "install" ? t("plHistoryInstall") : t("plHistoryUninstall")}</span>
                    <span className="grow">{formatDateTime(h.at)}</span>
                    <span className={h.ok ? "pl-valid-ok" : "pl-valid-bad"}>
                      {h.ok ? t("plHistoryOk") : t("plHistoryFail")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pl-modal-foot">
          <button type="button" className="pl-btn ghost" onClick={props.onEdit}>
            {t("pluginPipelineEdit")}
          </button>
          <span style={{ flex: 1 }} />
          {pipe.installed ? (
            <>
              <button type="button" className="pl-btn ghost" onClick={props.onInstall}>
                {t("plReinstall")}
              </button>
              <button type="button" className="pl-btn" onClick={props.onUninstall}>
                {t("pluginUninstall")}
              </button>
            </>
          ) : (
            <button type="button" className="pl-btn primary" onClick={props.onInstall}>
              {t("pluginInstall")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewPluginWizard(props: {
  defs: StepDefsPayload;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    type: "skill" | "mcp";
    mode: PipelineInstallMode;
    aiPrompt?: string;
  }) => void;
  busy: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<"skill" | "mcp">("mcp");
  const [mode, setMode] = useState<PipelineInstallMode>("remote");
  const [name, setName] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const modes = props.defs.installModes.filter((m) =>
    type === "skill" ? m.value === "skill_package" : m.value !== "skill_package",
  );

  useEffect(() => {
    if (type === "skill") setMode("skill_package");
    else if (mode === "skill_package") setMode("remote");
  }, [type]);

  return (
    <div className="pl-overlay" role="dialog" aria-modal="true">
      <div className="pl-modal">
        <div className="pl-modal-head">
          <div style={{ flex: 1 }}>
            <h3>{t("plNewWizardTitle")}</h3>
            <p className="pl-modal-sub">{t("plNewWizardHint")}</p>
          </div>
          <button type="button" className="pl-x" onClick={props.onClose} aria-label={t("close")}>
            ×
          </button>
        </div>
        <div className="pl-modal-body">
          {props.error ? <p className="pl-error">{props.error}</p> : null}
          <div className="pl-field">
            <label>{t("plNewWizardType")}</label>
            <div className="pl-choice-grid">
              {(["mcp", "skill"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={type === v ? "pl-choice active" : "pl-choice"}
                  onClick={() => setType(v)}
                >
                  <div className="pl-choice-title">{v === "mcp" ? "MCP" : "Skill"}</div>
                  <p className="pl-choice-desc">
                    {v === "mcp"
                      ? "外部工具、服务、数据源、执行能力"
                      : "提示词、知识、工作流、可复用能力"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="pl-field">
            <label>{t("plNewWizardMode")}</label>
            <div className="pl-choice-grid">
              {modes.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={mode === m.value ? "pl-choice active" : "pl-choice"}
                  onClick={() => setMode(m.value)}
                >
                  <div className="pl-choice-title">{m.label}</div>
                  <p className="pl-choice-desc">{m.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="pl-field">
            <label>{t("plNewWizardName")}</label>
            <input
              className="pl-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Plugin"
              autoFocus
            />
            {error ? <span className="pl-field-hint" style={{ color: "#c62828" }}>{error}</span> : null}
          </div>

          <div className="pl-field">
            <label>{t("plNewWizardAi")}</label>
            <textarea
              className="pl-textarea"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={t("plNewWizardAiPlaceholder")}
              style={{ minHeight: 76 }}
            />
            <span className="pl-field-hint">{t("plNewWizardAiHint")}</span>
          </div>
        </div>
        <div className="pl-modal-foot">
          <span style={{ flex: 1 }} />
          <button type="button" className="pl-btn ghost" onClick={props.onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="pl-btn primary"
            disabled={props.busy}
            onClick={() => {
              if (!name.trim()) {
                setError(t("plNameRequired"));
                return;
              }
              setError(null);
              props.onCreate({
                name: name.trim(),
                type,
                mode,
                ...(aiPrompt.trim() ? { aiPrompt: aiPrompt.trim() } : {}),
              });
            }}
          >
            {props.busy ? t("pluginBusy") : t("plNewWizardCreate")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PluginMarketplacePanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [system, setSystem] = useState<PipelineListItem[]>([]);
  const [custom, setCustom] = useState<PipelineListItem[]>([]);
  const [history, setHistory] = useState<PipelineInstallHistoryEntry[]>([]);
  const [defs, setDefs] = useState<StepDefsPayload | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<PipelineListItem | null>(null);
  const [detail, setDetail] = useState<PipelineListItem | null>(null);
  const [runner, setRunner] = useState<RunnerState | null>(null);
  const [wizard, setWizard] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [pipes, stepDefs] = await Promise.all([
      fetchPipelinesApi(),
      fetchStepDefinitionsApi(),
    ]);
    setSystem(pipes.system);
    setCustom(pipes.custom);
    setHistory(pipes.history);
    setDefs(stepDefs);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const all = useMemo(() => [...system, ...custom], [system, custom]);
  const anyRunning = all.some((p) => p.installJob?.status === "running");

  useEffect(() => {
    if (!anyRunning) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => {});
    }, 1600);
    return () => window.clearInterval(timer);
  }, [anyRunning, refresh]);

  const visible = useMemo(() => {
    return all.filter((p) => {
      if (filter === "skill") return p.outputs.includes("skill");
      if (filter === "mcp") return p.outputs.includes("mcp");
      return true;
    });
  }, [all, filter]);

  const installed = visible.filter((p) => p.installed);
  const available = visible.filter((p) => !p.installed);

  async function removeCustom(pipe: PipelineListItem) {
    if (!window.confirm(t("plDeleteConfirm"))) return;
    setBusyId(pipe.id);
    try {
      await deleteCustomPipelineApi(pipe.id);
      await refresh();
      if (editor?.id === pipe.id) setEditor(null);
      if (detail?.id === pipe.id) setDetail(null);
      setNotice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function createPlugin(input: {
    name: string;
    type: "skill" | "mcp";
    mode: PipelineInstallMode;
    aiPrompt?: string;
  }) {
    setBusyId("__create__");
    setWizardError(null);
    try {
      const created = await createCustomPipelineApi({
        name: input.name,
        installMode: input.mode,
        outputs: input.type === "skill" ? ["skill"] : ["mcp"],
      });
      if (input.aiPrompt) {
        try {
          const draft = await generatePipelineDraftApi({
            prompt: input.aiPrompt,
            kind: input.type,
            installMode: input.mode,
            currentYaml: created.yaml,
          });
          if (draft.valid) {
            await savePipelineYamlApi("tenant", created.id, draft.yaml);
          } else {
            setNotice(
              t("plAiCreateFailed", {
                error: draft.error ?? t("plValidateFail"),
              }),
            );
          }
        } catch (err) {
          setNotice(
            t("plAiCreateFailed", {
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }
      await refresh();
      setWizard(false);
      setWizardError(null);
      const pipes = await fetchPipelinesApi();
      const pipe = [...pipes.system, ...pipes.custom].find((p) => p.id === created.id);
      if (pipe) setEditor(pipe);
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="pl-page">
        <div className="pl-header">
          <div>
            <h2 className="pl-title">{t("pluginMarketTitle")}</h2>
            <p className="pl-subtitle">{t("pluginMarketDesc")}</p>
          </div>
        </div>
        <p className="pl-section-hint">{t("loading")}</p>
      </div>
    );
  }

  if (!defs) {
    return (
      <div className="pl-page">
        <p className="pl-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="pl-page">
      <div className="pl-header">
        <div>
          <h2 className="pl-title">{t("pluginMarketTitle")}</h2>
          <p className="pl-subtitle">{t("pluginMarketDesc")}</p>
        </div>
        <div className="pl-toolbar">
          <div className="pl-filters">
            {(
              [
                ["all", t("pluginFilterAll")],
                ["skill", t("pluginFilterSkill")],
                ["mcp", t("pluginFilterMcp")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={filter === id ? "pl-filter active" : "pl-filter"}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pl-btn primary"
            onClick={() => {
              setWizardError(null);
              setWizard(true);
            }}
          >
            ＋ {t("plNewPlugin")}
          </button>
        </div>
      </div>

      {error ? <p className="pl-error">{error}</p> : null}
      {notice ? <p className="pl-mini-hint">{notice}</p> : null}

      <section className="pl-section">
        <div className="pl-section-head">
          <h3 className="pl-section-title">{t("plSectionInstalled")}</h3>
          <span className="pl-section-count">{installed.length}</span>
        </div>
        <p className="pl-section-hint">{t("plSectionInstalledHint")}</p>
        {installed.length === 0 ? (
          <p className="pl-section-hint">{t("plEmptyInstalled")}</p>
        ) : (
          <div className="pl-grid">
            {installed.map((pipe) => (
              <PluginCard
                key={pipe.id}
                pipe={pipe}
                busy={busyId === pipe.id}
                onInstall={() => setRunner({ pipe, action: "install" })}
                onUninstall={() => setRunner({ pipe, action: "uninstall" })}
                onEdit={() => setEditor(pipe)}
                onDetail={() => setDetail(pipe)}
                onDelete={() => void removeCustom(pipe)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="pl-section">
        <div className="pl-section-head">
          <h3 className="pl-section-title">{t("plSectionAvailable")}</h3>
          <span className="pl-section-count">{available.length}</span>
        </div>
        <p className="pl-section-hint">{t("plSectionAvailableHint")}</p>
        {available.length === 0 ? (
          <p className="pl-section-hint">{t("plEmptyAvailable")}</p>
        ) : (
          <div className="pl-grid">
            {available.map((pipe) => (
              <PluginCard
                key={pipe.id}
                pipe={pipe}
                busy={busyId === pipe.id}
                onInstall={() => setRunner({ pipe, action: "install" })}
                onUninstall={() => setRunner({ pipe, action: "uninstall" })}
                onEdit={() => setEditor(pipe)}
                onDetail={() => setDetail(pipe)}
                onDelete={() => void removeCustom(pipe)}
              />
            ))}
          </div>
        )}
      </section>

      {runner ? (
        <PipelineInstallRunner
          pipe={runner.pipe}
          action={runner.action}
          onClose={() => setRunner(null)}
          onStarted={() => {
            void refresh().catch(() => {});
          }}
          onFinished={() => {
            void refresh().catch(() => {});
          }}
        />
      ) : null}

      {detail ? (
        <PluginDetail
          pipe={detail}
          history={history}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditor(detail);
            setDetail(null);
          }}
          onInstall={() => {
            setRunner({ pipe: detail, action: "install" });
            setDetail(null);
          }}
          onUninstall={() => {
            setRunner({ pipe: detail, action: "uninstall" });
            setDetail(null);
          }}
        />
      ) : null}

      {wizard ? (
        <NewPluginWizard
          defs={defs}
          busy={busyId === "__create__"}
          error={wizardError}
          onClose={() => {
            setWizard(false);
            setWizardError(null);
          }}
          onCreate={(input) => void createPlugin(input)}
        />
      ) : null}

      {editor ? (
        <PipelineOrchestrator
          pipe={editor}
          defs={defs}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setNotice(t("pluginPipelineSaved"));
            void refresh().catch(() => {});
          }}
        />
      ) : null}
    </div>
  );
}
