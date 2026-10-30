/**
 * 内嵌 AI 草稿面板：自然语言 → pipeline.yaml 草稿（不自动安装）。
 */
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { parsePipelineAst } from "../pipeline/pipelineAst";
import { ApiRequestError } from "../../services/api-request-error";
import {
  generatePipelineDraftApi,
  type AiPipelineDraft,
  type PipelineInstallMode,
  type PipelineInstallModeDefinition,
} from "../../services/endpoints";
import "./plugins.css";

type Props = {
  initialKind: "skill" | "mcp";
  initialMode: PipelineInstallMode;
  modes: PipelineInstallModeDefinition[];
  currentYaml: string;
  onClose: () => void;
  onApply: (yaml: string) => void;
};

export function AiPipelinePanel(props: Props) {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<"skill" | "mcp">(props.initialKind);
  const [mode, setMode] = useState<PipelineInstallMode>(props.initialMode);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AiPipelineDraft | null>(null);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const modeOptions = props.modes.filter((m) =>
    kind === "skill" ? m.value === "skill_package" : m.value !== "skill_package",
  );

  async function generate() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setElapsed(0);
    setDraft(null);
    setError(null);
    try {
      const res = await generatePipelineDraftApi({
        prompt: prompt.trim(),
        kind,
        installMode: mode,
        ...(props.currentYaml ? { currentYaml: props.currentYaml } : {}),
      });
      setDraft(res);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "MISSING_MODEL_CONFIG") {
        setError(t("plAiNeedModel"));
      } else {
        setError(
          t("plAiFailed", {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const draftValid = (() => {
    if (!draft) return false;
    try {
      parsePipelineAst(draft.yaml);
      return true;
    } catch {
      return false;
    }
  })();

  const examples =
    kind === "skill"
      ? [t("plAiExample3")]
      : [t("plAiExample1"), t("plAiExample2")];

  return (
    <div className="pl-overlay" role="dialog" aria-modal="true">
      <div className="pl-modal wide">
        <div className="pl-modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{t("plAiTitle")}</h3>
            <p className="pl-modal-sub">{t("plAiDesc")}</p>
          </div>
          <button type="button" className="pl-x" onClick={props.onClose} aria-label={t("close")}>
            ×
          </button>
        </div>

        <div className="pl-modal-body">
          <div className="pl-info">
            <span>①</span>
            <span>{t("plAiTranslateOnly")}</span>
          </div>
          <div className="pl-risk">
            <span>⚠</span>
            <span>{t("plAiToolRisk")}</span>
          </div>
          <div className="pl-form-grid">
            <div className="pl-field">
              <label>{t("plNewWizardType")}</label>
              <div className="pl-seg">
                <button
                  type="button"
                  className={kind === "mcp" ? "active" : ""}
                  onClick={() => {
                    setKind("mcp");
                    if (mode === "skill_package") setMode("remote");
                  }}
                >
                  MCP
                </button>
                <button
                  type="button"
                  className={kind === "skill" ? "active" : ""}
                  onClick={() => {
                    setKind("skill");
                    setMode("skill_package");
                  }}
                >
                  Skill
                </button>
              </div>
            </div>
            <div className="pl-field">
              <label>{t("plNewWizardMode")}</label>
              <select
                className="pl-select"
                value={mode}
                onChange={(e) => setMode(e.target.value as PipelineInstallMode)}
              >
                {modeOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pl-field">
            <label>{t("plAiPrompt")}</label>
            <textarea
              className="pl-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("plAiPlaceholder")}
              style={{ minHeight: 96 }}
            />
            <div className="pl-ai-chips">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  className="pl-chip"
                  onClick={() =>
                    setPrompt(
                      i === 0 && kind === "mcp"
                        ? "接入远程 MCP：https://example.com/mcp，使用 Authorization: Bearer 认证。"
                        : ex,
                    )
                  }
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="pl-error">{error}</p> : null}

          {busy ? (
            <div className="pl-ai-working">
              <span className="pl-spinner" />
              <span>
                {t("plAiWorking")} · {elapsed}s
              </span>
            </div>
          ) : null}

          {draft ? (
            <div className="pl-ai-result">
              <div className="pl-block-title">
                {t("plAiDraft")} · {draft.model}
              </div>
              <textarea
                className="pl-textarea mono"
                value={draft.yaml}
                onChange={(e) => setDraft({ ...draft, yaml: e.target.value })}
                style={{ minHeight: 300 }}
                spellCheck={false}
              />
              {draftValid ? (
                <span className="pl-valid-ok">{t("plValidateOk")}</span>
              ) : (
                <span className="pl-valid-bad">
                  {t("plAiInvalid", { error: draft.error ?? t("plValidateFail") })}
                </span>
              )}
              {draft.notes ? (
                <p className="pl-ai-note">
                  <strong>{t("plAiNotes")}</strong> {draft.notes}
                </p>
              ) : null}
              {draft.trace?.length ? (
                <details className="pl-ai-trace" open>
                  <summary>
                    {t("plAiTools")} · {draft.trace.length}
                  </summary>
                  <div className="pl-trace-list">
                    {draft.trace.map((item, i) => (
                      <div className="pl-trace-row" key={i}>
                        <span className={item.ok ? "pl-valid-ok" : "pl-valid-bad"}>
                          {item.ok ? "✓" : "!"}
                        </span>
                        <span className="pl-trace-tool">{item.tool}</span>
                        <span className="pl-trace-summary" title={item.summary}>
                          {item.summary}
                        </span>
                        <span className="pl-trace-ms">{item.durationMs}ms</span>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
              <p className="pl-ai-note">{t("plAiDesc")}</p>
            </div>
          ) : null}
        </div>

        <div className="pl-modal-foot">
          <button
            type="button"
            className="pl-btn"
            onClick={() => void generate()}
            disabled={busy || !prompt.trim()}
          >
            {busy ? t("pluginBusy") : t("plAiGenerate")}
          </button>
          <span className="spacer" />
          <button type="button" className="pl-btn ghost" onClick={props.onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="pl-btn primary"
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              props.onApply(draft.yaml);
              props.onClose();
            }}
          >
            {t("plAiApply")}
          </button>
        </div>
      </div>
    </div>
  );
}
